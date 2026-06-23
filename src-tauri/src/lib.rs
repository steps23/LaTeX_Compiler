mod tex_runtime;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::PathBuf};
use tauri::Manager;
use tex_runtime::TexRuntimeDiagnostic;

const RUNTIME_CONTRACT_VERSION: u8 = 1;
const STORAGE_CONTRACT_VERSION: u8 = 1;
const PROJECT_STORAGE_DIR: &str = "projects";
const PROJECT_METADATA_FILE: &str = "project.json";
const FILE_MANIFEST_FILE: &str = "files.json";
const PROJECT_FILES_DIR: &str = "files";
const TEX_RUNTIME_SELECTION_FILE: &str = "tex-runtime-selection.json";

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
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_runtime_info,
            get_storage_info,
            detect_tex_runtimes,
            get_tex_runtime_selection,
            save_tex_runtime_selection,
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
        detect_tex_runtimes, empty_tex_runtime_selection, get_runtime_info, validated_project_path,
        StorageInfo, STORAGE_CONTRACT_VERSION,
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
