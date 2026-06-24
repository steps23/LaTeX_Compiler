mod tex_runtime;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeSet,
    fs,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::Manager;
use tex_runtime::TexRuntimeDiagnostic;

const RUNTIME_CONTRACT_VERSION: u8 = 1;
const STORAGE_CONTRACT_VERSION: u8 = 1;
const PROJECT_STORAGE_DIR: &str = "projects";
const PROJECT_METADATA_FILE: &str = "project.json";
const FILE_MANIFEST_FILE: &str = "files.json";
const PROJECT_FILES_DIR: &str = "files";
const TEX_RUNTIME_SELECTION_FILE: &str = "tex-runtime-selection.json";
const COMPILE_WORK_DIR: &str = "compile-workspaces";
const COMPILE_ARTIFACT_DIR: &str = "compile-artifacts";
const COMPILE_TIMEOUT: Duration = Duration::from_secs(45);
const MAX_COMPILE_LOG_BYTES: u64 = 1_000_000;
const MAX_COMPILE_INPUT_BYTES: u64 = 200 * 1024 * 1024;
const MAX_COMPILE_FILES: usize = 5_000;
const MAX_PDF_BYTES: u64 = 100 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeInfo {
    contract_version: u8,
    runtime: &'static str,
    app_version: &'static str,
    os: &'static str,
    arch: &'static str,
    target_family: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageInfo {
    contract_version: u8,
    backend: &'static str,
    project_root_dir: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TexRuntimeSelection {
    contract_version: u8,
    selected_runtime_id: Option<String>,
    selected_bin_dir: Option<String>,
    updated_at: Option<u64>,
}

#[derive(Debug, Default)]
struct CompileJobRegistry {
    cancelled_jobs: Mutex<BTreeSet<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompileFilePayload {
    path: String,
    is_folder: bool,
    content: Option<String>,
    binary_bytes: Option<Vec<u8>>,
    is_deleted: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompileLatexRequest {
    job_id: String,
    main_path: String,
    runtime_id: Option<String>,
    compile_engine: Option<String>,
    files: Vec<CompileFilePayload>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeCompileMessage {
    severity: &'static str,
    message: String,
    file: Option<String>,
    line: Option<u64>,
    context: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeCompileResult {
    success: bool,
    pdf_bytes: Option<Vec<u8>>,
    raw_log: String,
    errors: Vec<NativeCompileMessage>,
    warnings: Vec<NativeCompileMessage>,
    duration_ms: u64,
    sync_tex: Option<NativeSyncTexArtifact>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeSyncTexArtifact {
    id: String,
    output: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncTexForwardRequest {
    artifact_id: String,
    input_path: String,
    line: u64,
    column: Option<u64>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SyncTexLocation {
    page: u64,
    x: f64,
    y: f64,
    h: Option<f64>,
    v: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
}

#[tauri::command]
fn get_runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        contract_version: RUNTIME_CONTRACT_VERSION,
        runtime: "tauri",
        app_version: env!("CARGO_PKG_VERSION"),
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        target_family: std::env::consts::FAMILY,
    }
}

fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || !id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
    {
        return Err("invalid id".into());
    }
    Ok(())
}

fn validated_project_path(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path.replace('\\', "/"));
    if candidate.as_os_str().is_empty() || candidate.is_absolute() {
        return Err("invalid project file path".into());
    }

    let mut clean = PathBuf::new();
    for component in candidate.components() {
        match component {
            std::path::Component::Normal(part) => clean.push(part),
            std::path::Component::CurDir => {}
            _ => return Err("invalid project file path".into()),
        }
    }

    if clean.as_os_str().is_empty() {
        return Err("invalid project file path".into());
    }
    Ok(clean)
}

fn app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create app data directory: {error}"))?;
    Ok(root)
}

fn project_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = app_data_root(app)?.join(PROJECT_STORAGE_DIR);
    fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create project storage directory: {error}"))?;
    Ok(root)
}

fn project_dir(app: &tauri::AppHandle, project_id: &str) -> Result<PathBuf, String> {
    validate_id(project_id)?;
    Ok(project_root(app)?.join(project_id))
}

fn json_string(value: &Value, key: &str) -> Result<String, String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("missing or invalid {key}"))
}

fn read_json_file(path: PathBuf) -> Result<Option<Value>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(|error| format!("failed to read json file: {error}"))?;
    serde_json::from_slice(&bytes).map(Some).map_err(|error| {
        format!(
            "failed to parse json file {}: {error}",
            path.to_string_lossy()
        )
    })
}

fn empty_tex_runtime_selection() -> TexRuntimeSelection {
    TexRuntimeSelection {
        contract_version: tex_runtime::TEX_RUNTIME_CONTRACT_VERSION,
        selected_runtime_id: None,
        selected_bin_dir: None,
        updated_at: None,
    }
}

fn mark_compile_job_started(registry: &CompileJobRegistry, job_id: &str) -> Result<(), String> {
    validate_id(job_id)?;
    let mut cancelled_jobs = registry
        .cancelled_jobs
        .lock()
        .map_err(|_| "failed to lock compile job registry".to_string())?;
    cancelled_jobs.remove(job_id);
    Ok(())
}

fn mark_compile_job_cancelled(registry: &CompileJobRegistry, job_id: &str) -> Result<(), String> {
    validate_id(job_id)?;
    let mut cancelled_jobs = registry
        .cancelled_jobs
        .lock()
        .map_err(|_| "failed to lock compile job registry".to_string())?;
    cancelled_jobs.insert(job_id.to_string());
    Ok(())
}

fn clear_compile_job(registry: &CompileJobRegistry, job_id: &str) -> Result<(), String> {
    let mut cancelled_jobs = registry
        .cancelled_jobs
        .lock()
        .map_err(|_| "failed to lock compile job registry".to_string())?;
    cancelled_jobs.remove(job_id);
    Ok(())
}

fn is_compile_job_cancelled(registry: &CompileJobRegistry, job_id: &str) -> Result<bool, String> {
    let cancelled_jobs = registry
        .cancelled_jobs
        .lock()
        .map_err(|_| "failed to lock compile job registry".to_string())?;
    Ok(cancelled_jobs.contains(job_id))
}

fn build_tex_runtime_selection(runtime_id: Option<String>) -> Result<TexRuntimeSelection, String> {
    let Some(runtime_id) = runtime_id else {
        return Ok(empty_tex_runtime_selection());
    };
    validate_id(&runtime_id)?;
    let diagnostic = tex_runtime::detect_tex_runtimes();
    let runtime = diagnostic
        .runtimes
        .into_iter()
        .find(|runtime| runtime.id == runtime_id)
        .ok_or_else(|| "selected TeX runtime was not detected".to_string())?;

    Ok(TexRuntimeSelection {
        contract_version: tex_runtime::TEX_RUNTIME_CONTRACT_VERSION,
        selected_runtime_id: Some(runtime.id),
        selected_bin_dir: Some(runtime.bin_dir),
        updated_at: Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|error| format!("failed to resolve system time: {error}"))?
                .as_millis()
                .try_into()
                .map_err(|_| "system time exceeds supported range".to_string())?,
        ),
    })
}

fn empty_compile_error(message: impl Into<String>, duration_ms: u64) -> NativeCompileResult {
    let message = message.into();
    NativeCompileResult {
        success: false,
        pdf_bytes: None,
        raw_log: message.clone(),
        errors: vec![NativeCompileMessage {
            severity: "error",
            message,
            file: None,
            line: None,
            context: None,
        }],
        warnings: vec![],
        duration_ms,
        sync_tex: None,
    }
}

fn compile_workspace_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("failed to resolve app cache directory: {error}"))?
        .join(COMPILE_WORK_DIR);
    fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create compile cache directory: {error}"))?;
    Ok(root)
}

fn compile_artifact_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("failed to resolve app cache directory: {error}"))?
        .join(COMPILE_ARTIFACT_DIR);
    fs::create_dir_all(&root)
        .map_err(|error| format!("failed to create compile artifact directory: {error}"))?;
    Ok(root)
}

fn compile_artifact_dir(app: &tauri::AppHandle, artifact_id: &str) -> Result<PathBuf, String> {
    validate_id(artifact_id)?;
    Ok(compile_artifact_root(app)?.join(artifact_id))
}

fn unique_compile_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("failed to resolve system time: {error}"))?
        .as_nanos();
    let dir = compile_workspace_root(app)?.join(format!("compile-{}-{unique}", std::process::id()));
    fs::create_dir_all(&dir)
        .map_err(|error| format!("failed to create compile workspace: {error}"))?;
    Ok(dir)
}

fn write_compile_workspace(
    work_dir: &std::path::Path,
    request: &CompileLatexRequest,
) -> Result<(), String> {
    let main_path = validated_project_path(&request.main_path)?;
    let mut has_main_file = false;
    let mut written_files = 0usize;
    let mut total_input_bytes = 0u64;

    for file in &request.files {
        if file.is_folder || file.is_deleted.unwrap_or(false) {
            continue;
        }
        let relative_path = validated_project_path(&file.path)?;
        if relative_path == main_path {
            has_main_file = true;
        }
        written_files += 1;
        if written_files > MAX_COMPILE_FILES {
            return Err(format!(
                "project exceeds maximum compile file count of {MAX_COMPILE_FILES}"
            ));
        }
        let input_size = file
            .content
            .as_ref()
            .map(|content| content.len() as u64)
            .or_else(|| file.binary_bytes.as_ref().map(|bytes| bytes.len() as u64))
            .unwrap_or(0);
        total_input_bytes = total_input_bytes.saturating_add(input_size);
        if total_input_bytes > MAX_COMPILE_INPUT_BYTES {
            return Err(format!(
                "project exceeds maximum compile input size of {MAX_COMPILE_INPUT_BYTES} bytes"
            ));
        }

        let disk_path = work_dir.join(relative_path);
        if let Some(parent) = disk_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("failed to create compile file parent: {error}"))?;
        }
        if let Some(content) = &file.content {
            fs::write(&disk_path, content)
                .map_err(|error| format!("failed to write compile text file: {error}"))?;
        } else if let Some(bytes) = &file.binary_bytes {
            fs::write(&disk_path, bytes)
                .map_err(|error| format!("failed to write compile binary file: {error}"))?;
        }
    }

    if !has_main_file {
        return Err(format!("main file {} not found", request.main_path));
    }
    Ok(())
}

fn validate_compile_engine(engine: Option<&str>) -> Result<&str, String> {
    match engine.unwrap_or("auto") {
        "auto" | "latexmk" | "pdflatex" | "xelatex" | "lualatex" => Ok(engine.unwrap_or("auto")),
        _ => Err("invalid TeX compile engine".into()),
    }
}

fn selected_compile_tool(
    runtime_id: &str,
    compile_engine: Option<&str>,
) -> Result<(String, String, Vec<String>), String> {
    let compile_engine = validate_compile_engine(compile_engine)?;
    validate_id(runtime_id)?;
    let diagnostic = tex_runtime::detect_tex_runtimes();
    let runtime = diagnostic
        .runtimes
        .into_iter()
        .find(|runtime| runtime.id == runtime_id)
        .ok_or_else(|| "selected TeX runtime was not detected".to_string())?;

    let available_path = |name: &str| {
        runtime
            .tools
            .iter()
            .find(|tool| tool.name == name && tool.status == tex_runtime::TexToolStatus::Available)
            .map(|tool| tool.path.clone())
    };

    if matches!(compile_engine, "auto" | "latexmk") {
        if let Some(path) = available_path("latexmk") {
            return Ok((
                "latexmk".into(),
                path,
                vec![
                    "-pdf".into(),
                    "-interaction=nonstopmode".into(),
                    "-halt-on-error".into(),
                    "-file-line-error".into(),
                    "-synctex=1".into(),
                    request_safe_job_arg(),
                ],
            ));
        }
        if compile_engine == "latexmk" {
            return Err("selected TeX runtime does not provide latexmk".into());
        }
    }
    let engine_candidates: Vec<&str> = if compile_engine == "auto" {
        vec!["pdflatex", "xelatex", "lualatex"]
    } else {
        vec![compile_engine]
    };
    for name in engine_candidates {
        if let Some(path) = available_path(name) {
            return Ok((
                name.into(),
                path,
                vec![
                    "-interaction=nonstopmode".into(),
                    "-halt-on-error".into(),
                    "-file-line-error".into(),
                    "-synctex=1".into(),
                    request_safe_job_arg(),
                ],
            ));
        }
    }

    Err("selected TeX runtime has no available PDF compiler".into())
}

fn selected_runtime_tool(runtime_id: &str, tool_name: &str) -> Result<String, String> {
    validate_id(runtime_id)?;
    let diagnostic = tex_runtime::detect_tex_runtimes();
    let runtime = diagnostic
        .runtimes
        .into_iter()
        .find(|runtime| runtime.id == runtime_id)
        .ok_or_else(|| "selected TeX runtime was not detected".to_string())?;
    runtime
        .tools
        .into_iter()
        .find(|tool| tool.name == tool_name && tool.status == tex_runtime::TexToolStatus::Available)
        .map(|tool| tool.path)
        .ok_or_else(|| format!("selected TeX runtime does not provide {tool_name}"))
}

fn request_safe_job_arg() -> String {
    "-jobname=main".into()
}

fn read_capped_text_file(path: &std::path::Path, label: &str) -> Result<String, String> {
    if !path.is_file() {
        return Ok(String::new());
    }
    let bytes = fs::read(path).map_err(|error| format!("failed to read {label}: {error}"))?;
    let truncated = bytes.len() as u64 > MAX_COMPILE_LOG_BYTES;
    let mut bytes = bytes;
    bytes.truncate(MAX_COMPILE_LOG_BYTES as usize);
    let mut text = String::from_utf8_lossy(&bytes).into_owned();
    if truncated {
        text.push_str("\n[TeXForge truncated compiler output at 1000000 bytes]\n");
    }
    Ok(text)
}

fn read_pdf_bytes(path: &std::path::Path) -> Result<Vec<u8>, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("failed to inspect compiled PDF: {error}"))?;
    if metadata.len() > MAX_PDF_BYTES {
        return Err(format!(
            "compiled PDF exceeds maximum supported size of {MAX_PDF_BYTES} bytes"
        ));
    }
    fs::read(path).map_err(|error| format!("failed to read compiled PDF: {error}"))
}

fn run_compile_process(
    tool_path: &str,
    args: &[String],
    main_path: &str,
    work_dir: &std::path::Path,
    run_number: usize,
    registry: &CompileJobRegistry,
    job_id: &str,
) -> Result<(bool, String), String> {
    let main_path = validated_project_path(main_path)?;
    let stdout_path = work_dir.join(format!("texforge-stdout-{run_number}.log"));
    let stderr_path = work_dir.join(format!("texforge-stderr-{run_number}.log"));
    let stdout = fs::File::create(&stdout_path)
        .map_err(|error| format!("failed to create compiler stdout log: {error}"))?;
    let stderr = fs::File::create(&stderr_path)
        .map_err(|error| format!("failed to create compiler stderr log: {error}"))?;

    let mut child = Command::new(tool_path)
        .args(args)
        .arg(main_path)
        .current_dir(work_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()
        .map_err(|error| format!("failed to start local TeX compiler: {error}"))?;

    let start = Instant::now();
    loop {
        if is_compile_job_cancelled(registry, job_id)? {
            let _ = child.kill();
            let _ = child.wait();
            return Err("local TeX compilation cancelled".into());
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                let _ = child.wait();
                let mut log = read_capped_text_file(&stdout_path, "compiler stdout")?;
                let stderr = read_capped_text_file(&stderr_path, "compiler stderr")?;
                if !stderr.trim().is_empty() {
                    log.push_str("\n--- stderr ---\n");
                    log.push_str(&stderr);
                }
                return Ok((status.success(), log));
            }
            Ok(None) if start.elapsed() >= COMPILE_TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("local TeX compilation timed out".into());
            }
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(error) => return Err(format!("failed waiting for compiler: {error}")),
        }
    }
}

fn parse_compile_errors(raw_log: &str) -> Vec<NativeCompileMessage> {
    let mut errors = Vec::new();
    for line in raw_log.lines() {
        if let Some((file, rest)) = line.split_once(':') {
            if let Some((line_number, message)) = rest.split_once(':') {
                if let Ok(line_number) = line_number.parse::<u64>() {
                    errors.push(NativeCompileMessage {
                        severity: "error",
                        message: message.trim().to_string(),
                        file: Some(file.to_string()),
                        line: Some(line_number),
                        context: Some(line.to_string()),
                    });
                }
            }
        }
        if errors.is_empty() && line.starts_with('!') {
            errors.push(NativeCompileMessage {
                severity: "error",
                message: line.trim_start_matches('!').trim().to_string(),
                file: None,
                line: None,
                context: Some(line.to_string()),
            });
        }
    }
    if errors.is_empty() {
        errors.push(NativeCompileMessage {
            severity: "error",
            message: "Local TeX compilation failed".into(),
            file: None,
            line: None,
            context: None,
        });
    }
    errors
}

fn parse_synctex_view_output(output: &str) -> Option<SyncTexLocation> {
    let mut page = None;
    let mut x = None;
    let mut y = None;
    let mut h = None;
    let mut v = None;
    let mut width = None;
    let mut height = None;

    for line in output.lines() {
        if let Some((key, value)) = line.split_once(':') {
            match key {
                "Page" => page = value.trim().parse::<u64>().ok(),
                "x" => x = value.trim().parse::<f64>().ok(),
                "y" => y = value.trim().parse::<f64>().ok(),
                "h" => h = value.trim().parse::<f64>().ok(),
                "v" => v = value.trim().parse::<f64>().ok(),
                "W" => width = value.trim().parse::<f64>().ok(),
                "H" => height = value.trim().parse::<f64>().ok(),
                _ => {}
            }
        }
    }

    Some(SyncTexLocation {
        page: page?,
        x: x?,
        y: y?,
        h,
        v,
        width,
        height,
    })
}

fn move_successful_compile_artifact(
    app: &tauri::AppHandle,
    artifact_id: &str,
    runtime_id: &str,
    work_dir: &std::path::Path,
) -> Result<NativeSyncTexArtifact, String> {
    let artifact_dir = compile_artifact_dir(app, artifact_id)?;
    if artifact_dir.exists() {
        fs::remove_dir_all(&artifact_dir)
            .map_err(|error| format!("failed to replace old compile artifact: {error}"))?;
    }
    fs::rename(work_dir, &artifact_dir)
        .map_err(|error| format!("failed to persist compile artifact: {error}"))?;
    fs::write(artifact_dir.join("tex-runtime-id.txt"), runtime_id)
        .map_err(|error| format!("failed to persist SyncTeX runtime metadata: {error}"))?;
    Ok(NativeSyncTexArtifact {
        id: artifact_id.to_string(),
        output: "main.pdf".into(),
    })
}

fn write_json_file(path: PathBuf, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create metadata directory: {error}"))?;
    }
    let json = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("failed to serialize metadata: {error}"))?;
    fs::write(path, json).map_err(|error| format!("failed to write metadata: {error}"))
}

fn read_file_manifest(project_dir: PathBuf) -> Result<Vec<Value>, String> {
    match read_json_file(project_dir.join(FILE_MANIFEST_FILE))? {
        Some(Value::Array(files)) => Ok(files),
        Some(_) => Err("invalid file manifest".into()),
        None => Ok(Vec::new()),
    }
}

fn write_file_manifest(project_dir: PathBuf, files: Vec<Value>) -> Result<(), String> {
    write_json_file(project_dir.join(FILE_MANIFEST_FILE), &Value::Array(files))
}

#[tauri::command]
fn get_storage_info(app: tauri::AppHandle) -> Result<StorageInfo, String> {
    let project_root = project_root(&app)?;

    Ok(StorageInfo {
        contract_version: STORAGE_CONTRACT_VERSION,
        backend: "tauri-app-data",
        project_root_dir: project_root.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn detect_tex_runtimes() -> TexRuntimeDiagnostic {
    tex_runtime::detect_tex_runtimes()
}

#[tauri::command]
fn get_tex_runtime_selection(app: tauri::AppHandle) -> Result<TexRuntimeSelection, String> {
    let path = app_data_root(&app)?.join(TEX_RUNTIME_SELECTION_FILE);
    let Some(value) = read_json_file(path)? else {
        return Ok(empty_tex_runtime_selection());
    };
    serde_json::from_value(value).map_err(|error| format!("invalid TeX runtime selection: {error}"))
}

#[tauri::command]
fn save_tex_runtime_selection(
    app: tauri::AppHandle,
    runtime_id: Option<String>,
) -> Result<TexRuntimeSelection, String> {
    let selection = build_tex_runtime_selection(runtime_id)?;
    let value = serde_json::to_value(&selection)
        .map_err(|error| format!("failed to serialize TeX runtime selection: {error}"))?;
    write_json_file(
        app_data_root(&app)?.join(TEX_RUNTIME_SELECTION_FILE),
        &value,
    )?;
    Ok(selection)
}

#[tauri::command]
fn compile_latex_project(
    app: tauri::AppHandle,
    registry: tauri::State<CompileJobRegistry>,
    request: CompileLatexRequest,
) -> Result<NativeCompileResult, String> {
    let start = Instant::now();
    mark_compile_job_started(&registry, &request.job_id)?;
    let Some(runtime_id) = request.runtime_id.as_deref() else {
        return Ok(empty_compile_error(
            "No TeX runtime selected. Open LaTeX Environment and choose a runtime before compiling locally.",
            0,
        ));
    };

    let work_dir = unique_compile_dir(&app)?;
    let result = (|| -> Result<NativeCompileResult, String> {
        write_compile_workspace(&work_dir, &request)?;
        let (tool_name, tool_path, args) =
            selected_compile_tool(runtime_id, request.compile_engine.as_deref())?;
        let compile_runs = if tool_name == "latexmk" { 1 } else { 2 };
        let mut success = false;
        let mut raw_log = String::new();
        for run_number in 1..=compile_runs {
            let (run_success, run_log) = run_compile_process(
                &tool_path,
                &args,
                &request.main_path,
                &work_dir,
                run_number,
                &registry,
                &request.job_id,
            )?;
            raw_log.push_str(&format!("\n--- {tool_name} run {run_number} ---\n"));
            raw_log.push_str(&run_log);
            success = run_success;
            if !run_success {
                break;
            }
        }
        let duration_ms = start.elapsed().as_millis().try_into().unwrap_or(u64::MAX);
        let pdf_path = work_dir.join("main.pdf");
        let pdf_bytes = if success && pdf_path.is_file() {
            Some(read_pdf_bytes(&pdf_path)?)
        } else {
            None
        };

        if success && pdf_bytes.is_some() {
            let sync_tex = if work_dir.join("main.synctex.gz").is_file()
                || work_dir.join("main.synctex").is_file()
            {
                Some(move_successful_compile_artifact(
                    &app,
                    &request.job_id,
                    runtime_id,
                    &work_dir,
                )?)
            } else {
                None
            };
            Ok(NativeCompileResult {
                success: true,
                pdf_bytes,
                raw_log: format!("Local TeX compilation succeeded with {tool_name}.\n\n{raw_log}"),
                errors: vec![],
                warnings: vec![],
                duration_ms,
                sync_tex,
            })
        } else {
            let errors = parse_compile_errors(&raw_log);
            Ok(NativeCompileResult {
                success: false,
                pdf_bytes: None,
                raw_log,
                errors,
                warnings: vec![],
                duration_ms,
                sync_tex: None,
            })
        }
    })();

    if work_dir.exists() {
        let _ = fs::remove_dir_all(&work_dir);
    }
    let _ = clear_compile_job(&registry, &request.job_id);

    match result {
        Ok(result) => Ok(result),
        Err(error) => Ok(empty_compile_error(
            error,
            start.elapsed().as_millis().try_into().unwrap_or(u64::MAX),
        )),
    }
}

#[tauri::command]
fn cancel_latex_compile(
    registry: tauri::State<CompileJobRegistry>,
    job_id: String,
) -> Result<(), String> {
    mark_compile_job_cancelled(&registry, &job_id)
}

#[tauri::command]
fn query_synctex_forward(
    app: tauri::AppHandle,
    request: SyncTexForwardRequest,
) -> Result<Option<SyncTexLocation>, String> {
    validate_id(&request.artifact_id)?;
    if request.line == 0 {
        return Err("SyncTeX line must be 1-based".into());
    }
    let input_path = validated_project_path(&request.input_path)?;
    let artifact_dir = compile_artifact_dir(&app, &request.artifact_id)?;
    let pdf_path = artifact_dir.join("main.pdf");
    if !pdf_path.is_file() {
        return Ok(None);
    }
    let runtime_id = fs::read_to_string(artifact_dir.join("tex-runtime-id.txt"))
        .map_err(|error| format!("failed to read SyncTeX runtime metadata: {error}"))?;
    let synctex_path = selected_runtime_tool(runtime_id.trim(), "synctex")?;
    let input = format!(
        "{}:{}:{}",
        request.line,
        request.column.unwrap_or(1).max(1),
        input_path.to_string_lossy()
    );
    let output = Command::new(synctex_path)
        .args(["view", "-i", input.as_str(), "-o", "main.pdf"])
        .current_dir(&artifact_dir)
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to run SyncTeX: {error}"))?;
    let mut text = String::from_utf8_lossy(&output.stdout).into_owned();
    if !output.stderr.is_empty() {
        text.push_str(&String::from_utf8_lossy(&output.stderr));
    }
    if !output.status.success() && !text.contains("SyncTeX result begin") {
        return Err(format!("SyncTeX lookup failed: {}", text.trim()));
    }
    Ok(parse_synctex_view_output(&text))
}

#[tauri::command]
fn get_all_projects(app: tauri::AppHandle) -> Result<Vec<Value>, String> {
    let root = project_root(&app)?;
    let mut projects = Vec::new();

    for entry in fs::read_dir(root).map_err(|error| format!("failed to list projects: {error}"))? {
        let entry = entry.map_err(|error| format!("failed to read project entry: {error}"))?;
        if !entry
            .file_type()
            .map_err(|error| format!("failed to inspect project entry: {error}"))?
            .is_dir()
        {
            continue;
        }
        if let Some(project) = read_json_file(entry.path().join(PROJECT_METADATA_FILE))? {
            projects.push(project);
        }
    }

    Ok(projects)
}

#[tauri::command]
fn get_project(app: tauri::AppHandle, id: String) -> Result<Option<Value>, String> {
    read_json_file(project_dir(&app, &id)?.join(PROJECT_METADATA_FILE))
}

#[tauri::command]
fn save_project(app: tauri::AppHandle, project: Value) -> Result<(), String> {
    let id = json_string(&project, "id")?;
    let dir = project_dir(&app, &id)?;
    fs::create_dir_all(dir.join(PROJECT_FILES_DIR))
        .map_err(|error| format!("failed to create project directory: {error}"))?;
    write_json_file(dir.join(PROJECT_METADATA_FILE), &project)
}

#[tauri::command]
fn delete_project(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let dir = project_dir(&app, &id)?;
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|error| format!("failed to delete project: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
fn get_project_files(app: tauri::AppHandle, project_id: String) -> Result<Vec<Value>, String> {
    read_file_manifest(project_dir(&app, &project_id)?)
}

#[tauri::command]
fn get_file(app: tauri::AppHandle, id: String) -> Result<Option<Value>, String> {
    validate_id(&id)?;
    for project in get_all_projects(app.clone())? {
        let project_id = json_string(&project, "id")?;
        if let Some(file) = read_file_manifest(project_dir(&app, &project_id)?)?
            .into_iter()
            .find(|file| file.get("id").and_then(Value::as_str) == Some(id.as_str()))
        {
            return Ok(Some(file));
        }
    }
    Ok(None)
}

#[tauri::command]
fn save_file(app: tauri::AppHandle, file: Value) -> Result<(), String> {
    let id = json_string(&file, "id")?;
    let project_id = json_string(&file, "projectId")?;
    let relative_path = validated_project_path(&json_string(&file, "path")?)?;
    let is_folder = file
        .get("isFolder")
        .and_then(Value::as_bool)
        .ok_or_else(|| "missing or invalid isFolder".to_string())?;

    validate_id(&id)?;
    let dir = project_dir(&app, &project_id)?;
    fs::create_dir_all(dir.join(PROJECT_FILES_DIR))
        .map_err(|error| format!("failed to create project file directory: {error}"))?;

    let disk_path = dir.join(PROJECT_FILES_DIR).join(relative_path);
    if is_folder {
        fs::create_dir_all(&disk_path)
            .map_err(|error| format!("failed to create project folder: {error}"))?;
    } else if let Some(parent) = disk_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create project file parent: {error}"))?;
        if let Some(content) = file.get("content").and_then(Value::as_str) {
            fs::write(&disk_path, content)
                .map_err(|error| format!("failed to write project text file: {error}"))?;
        } else if let Some(bytes) = file.get("binaryBytes").and_then(Value::as_array) {
            let bytes: Result<Vec<u8>, String> = bytes
                .iter()
                .map(|value| {
                    value
                        .as_u64()
                        .and_then(|byte| u8::try_from(byte).ok())
                        .ok_or_else(|| "invalid binary byte".to_string())
                })
                .collect();
            fs::write(&disk_path, bytes?)
                .map_err(|error| format!("failed to write project binary file: {error}"))?;
        } else {
            fs::write(&disk_path, [])
                .map_err(|error| format!("failed to create project file: {error}"))?;
        }
    }

    let mut files = read_file_manifest(dir.clone())?;
    files.retain(|existing| existing.get("id").and_then(Value::as_str) != Some(id.as_str()));
    files.push(file);
    write_file_manifest(dir, files)
}

#[tauri::command]
fn delete_file(app: tauri::AppHandle, id: String) -> Result<(), String> {
    validate_id(&id)?;
    for project in get_all_projects(app.clone())? {
        let project_id = json_string(&project, "id")?;
        let dir = project_dir(&app, &project_id)?;
        let mut files = read_file_manifest(dir.clone())?;
        if let Some(index) = files
            .iter()
            .position(|file| file.get("id").and_then(Value::as_str) == Some(id.as_str()))
        {
            let file = files.remove(index);
            let relative_path = validated_project_path(&json_string(&file, "path")?)?;
            let disk_path = dir.join(PROJECT_FILES_DIR).join(relative_path);
            if disk_path.is_dir() {
                fs::remove_dir_all(&disk_path)
                    .map_err(|error| format!("failed to delete project folder: {error}"))?;
            } else if disk_path.exists() {
                fs::remove_file(&disk_path)
                    .map_err(|error| format!("failed to delete project file: {error}"))?;
            }
            write_file_manifest(dir, files)?;
            return Ok(());
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CompileJobRegistry::default())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_runtime_info,
            get_storage_info,
            detect_tex_runtimes,
            get_tex_runtime_selection,
            save_tex_runtime_selection,
            compile_latex_project,
            cancel_latex_compile,
            query_synctex_forward,
            get_all_projects,
            get_project,
            save_project,
            delete_project,
            get_project_files,
            get_file,
            save_file,
            delete_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        clear_compile_job, detect_tex_runtimes, empty_compile_error, empty_tex_runtime_selection,
        get_runtime_info, is_compile_job_cancelled, mark_compile_job_cancelled,
        mark_compile_job_started, parse_synctex_view_output, read_capped_text_file,
        validate_compile_engine, validated_project_path, write_compile_workspace,
        CompileFilePayload, CompileJobRegistry, CompileLatexRequest, StorageInfo,
        STORAGE_CONTRACT_VERSION,
    };

    #[test]
    fn runtime_info_uses_the_versioned_frontend_contract() {
        let info = serde_json::to_value(get_runtime_info())
            .expect("runtime information should be serializable");

        assert_eq!(info["contractVersion"], 1);
        assert_eq!(info["runtime"], "tauri");
        assert!(info["appVersion"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(info["os"].as_str().is_some_and(|value| !value.is_empty()));
        assert!(info["arch"].as_str().is_some_and(|value| !value.is_empty()));
        assert!(matches!(
            info["targetFamily"].as_str(),
            Some("unix" | "windows" | "unknown")
        ));
    }

    #[test]
    fn storage_info_uses_the_versioned_frontend_contract() {
        let info = serde_json::to_value(StorageInfo {
            contract_version: STORAGE_CONTRACT_VERSION,
            backend: "tauri-app-data",
            project_root_dir: "/tmp/TeXForge/projects".into(),
        })
        .expect("storage information should be serializable");

        assert_eq!(info["contractVersion"], 1);
        assert_eq!(info["backend"], "tauri-app-data");
        assert!(info["projectRootDir"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
    }

    #[test]
    fn tex_runtime_diagnostic_uses_the_versioned_frontend_contract() {
        let info = serde_json::to_value(detect_tex_runtimes())
            .expect("TeX runtime diagnostic should be serializable");

        assert_eq!(info["contractVersion"], 1);
        assert!(info["hostOs"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(info["hostArch"]
            .as_str()
            .is_some_and(|value| !value.is_empty()));
        assert!(info["runtimes"].is_array());
        assert!(info["missingCoreTools"].is_array());
        assert!(info["notes"].is_array());
    }

    #[test]
    fn compile_job_registry_tracks_cancellation() {
        let registry = CompileJobRegistry::default();

        mark_compile_job_started(&registry, "job-1").unwrap();
        assert!(!is_compile_job_cancelled(&registry, "job-1").unwrap());
        mark_compile_job_cancelled(&registry, "job-1").unwrap();
        assert!(is_compile_job_cancelled(&registry, "job-1").unwrap());
        clear_compile_job(&registry, "job-1").unwrap();
        assert!(!is_compile_job_cancelled(&registry, "job-1").unwrap());
    }

    #[test]
    fn compile_engine_validation_allows_only_known_engines() {
        assert_eq!(validate_compile_engine(None).unwrap(), "auto");
        assert_eq!(validate_compile_engine(Some("xelatex")).unwrap(), "xelatex");
        assert!(validate_compile_engine(Some("sh")).is_err());
    }

    #[test]
    fn native_compile_result_uses_the_frontend_contract() {
        let info = serde_json::to_value(empty_compile_error("fixture", 12))
            .expect("native compile result should be serializable");

        assert_eq!(info["success"], false);
        assert!(info["pdfBytes"].is_null());
        assert_eq!(info["rawLog"], "fixture");
        assert_eq!(info["errors"][0]["severity"], "error");
        assert_eq!(info["durationMs"], 12);
        assert!(info["syncTex"].is_null());
    }

    #[test]
    fn synctex_view_output_parses_first_location() {
        let output = "SyncTeX result begin\nOutput:main.pdf\nPage:2\nx:171.128296\ny:134.764618\nh:133.768356\nv:134.764618\nW:343.711060\nH:6.918498\nSyncTeX result end";

        let location = parse_synctex_view_output(output).expect("location should parse");

        assert_eq!(location.page, 2);
        assert_eq!(location.x, 171.128296);
        assert_eq!(location.y, 134.764618);
        assert_eq!(location.width, Some(343.711060));
        assert_eq!(location.height, Some(6.918498));
    }

    #[test]
    fn compile_workspace_rejects_too_many_files() {
        let work_dir = std::env::temp_dir().join(format!(
            "texforge-compile-limit-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(&work_dir).expect("compile limit dir should be created");
        let files = (0..=super::MAX_COMPILE_FILES)
            .map(|index| CompileFilePayload {
                path: if index == 0 {
                    "main.tex".into()
                } else {
                    format!("file-{index}.tex")
                },
                is_folder: false,
                content: Some("fixture".into()),
                binary_bytes: None,
                is_deleted: None,
            })
            .collect();
        let request = CompileLatexRequest {
            job_id: "job-1".into(),
            main_path: "main.tex".into(),
            runtime_id: None,
            compile_engine: Some("auto".into()),
            files,
        };

        let error =
            write_compile_workspace(&work_dir, &request).expect_err("file limit should fail");

        assert!(error.contains("maximum compile file count"));
        let _ = std::fs::remove_dir_all(work_dir);
    }

    #[test]
    fn compile_log_reader_truncates_large_output() {
        let path = std::env::temp_dir().join(format!(
            "texforge-large-log-{}-{}.log",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos()
        ));
        std::fs::write(&path, vec![b'a'; 1_000_010]).expect("large log should be written");

        let log = read_capped_text_file(&path, "fixture log").expect("large log should be read");

        assert!(log.contains("truncated compiler output"));
        assert!(log.len() < 1_000_100);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn tex_runtime_selection_uses_the_versioned_frontend_contract() {
        let info = serde_json::to_value(empty_tex_runtime_selection())
            .expect("TeX runtime selection should be serializable");

        assert_eq!(info["contractVersion"], 1);
        assert!(info["selectedRuntimeId"].is_null());
        assert!(info["selectedBinDir"].is_null());
        assert!(info["updatedAt"].is_null());
    }

    #[test]
    fn project_file_paths_must_stay_relative_to_project_root() {
        assert!(validated_project_path("main.tex").is_ok());
        assert!(validated_project_path("chapters/intro.tex").is_ok());
        assert!(validated_project_path("../secret.txt").is_err());
        assert!(validated_project_path("/tmp/secret.txt").is_err());
        assert!(validated_project_path("chapters/../../secret.txt").is_err());
    }
}
