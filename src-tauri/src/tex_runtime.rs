use serde::Serialize;
use std::{
    collections::BTreeMap,
    env, fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

pub const TEX_RUNTIME_CONTRACT_VERSION: u8 = 1;
const VERSION_TIMEOUT: Duration = Duration::from_millis(1200);
const MAX_VERSION_BYTES: usize = 2048;

const TEX_TOOLS: &[&str] = &[
    "latexmk",
    "pdflatex",
    "latex",
    "xelatex",
    "lualatex",
    "bibtex",
    "biber",
    "makeindex",
    "makeglossaries",
    "synctex",
    "kpsewhich",
    "tlmgr",
    "mpm",
    "initexmf",
    "latexindent",
    "chktex",
    "texcount",
    "texdoc",
    "dvipdfmx",
    "dvips",
];

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TexDistributionKind {
    MacTex,
    TexLive,
    MikTex,
    Unknown,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TexToolStatus {
    Available,
    VersionFailed,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TexRuntimeStatus {
    Available,
    Partial,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PackageManagerKind {
    Tlmgr,
    Mpm,
    None,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TexTool {
    pub name: String,
    pub path: String,
    pub version: Option<String>,
    pub status: TexToolStatus,
    pub diagnostic: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TexRuntimeCapabilities {
    pub can_compile_pdf: bool,
    pub has_bibliography: bool,
    pub has_package_manager: bool,
    pub has_synctex: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TexRuntime {
    pub id: String,
    pub distribution: TexDistributionKind,
    pub version: Option<String>,
    pub arch: String,
    pub root_dir: Option<String>,
    pub bin_dir: String,
    pub tools: Vec<TexTool>,
    pub package_manager: PackageManagerKind,
    pub status: TexRuntimeStatus,
    pub detection_source: String,
    pub compatible_with_host: bool,
    pub capabilities: TexRuntimeCapabilities,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TexRuntimeDiagnostic {
    pub contract_version: u8,
    pub host_os: &'static str,
    pub host_arch: &'static str,
    pub runtimes: Vec<TexRuntime>,
    pub missing_core_tools: Vec<String>,
    pub notes: Vec<String>,
}

pub fn detect_tex_runtimes() -> TexRuntimeDiagnostic {
    detect_tex_runtimes_from_env(env::var_os("PATH"), known_tex_bins())
}

fn detect_tex_runtimes_from_env(
    path_env: Option<std::ffi::OsString>,
    known_bins: Vec<(PathBuf, &'static str)>,
) -> TexRuntimeDiagnostic {
    let mut candidates: BTreeMap<PathBuf, String> = BTreeMap::new();

    if let Some(paths) = path_env {
        for path in env::split_paths(&paths) {
            candidates
                .entry(path)
                .or_insert_with(|| "process PATH".into());
        }
    }

    for (path, source) in known_bins {
        candidates.entry(path).or_insert_with(|| source.to_string());
    }

    let mut runtimes: Vec<TexRuntime> = candidates
        .into_iter()
        .filter_map(|(bin_dir, source)| detect_runtime_in_bin_dir(&bin_dir, &source))
        .collect();

    runtimes.sort_by(|left, right| left.bin_dir.cmp(&right.bin_dir));

    let missing_core_tools = missing_core_tools(&runtimes);
    let mut notes = vec![
        "Detection uses explicit executable paths and does not invoke a shell.".into(),
        "GUI apps may receive a different PATH than an interactive shell.".into(),
        "Custom runtime paths and package operations are deferred to a later phase.".into(),
    ];
    if runtimes.is_empty() {
        notes.push(
            "No LaTeX runtime detected in process PATH or known platform directories.".into(),
        );
    }

    TexRuntimeDiagnostic {
        contract_version: TEX_RUNTIME_CONTRACT_VERSION,
        host_os: std::env::consts::OS,
        host_arch: std::env::consts::ARCH,
        runtimes,
        missing_core_tools,
        notes,
    }
}

fn known_tex_bins() -> Vec<(PathBuf, &'static str)> {
    let mut bins = Vec::new();

    #[cfg(target_os = "macos")]
    {
        bins.push((
            PathBuf::from("/Library/TeX/texbin"),
            "MacTeX /Library/TeX/texbin",
        ));
        bins.push((
            PathBuf::from("/usr/local/texlive/2026/bin/universal-darwin"),
            "TeX Live 2026",
        ));
        bins.push((
            PathBuf::from("/usr/local/texlive/2025/bin/universal-darwin"),
            "TeX Live 2025",
        ));
        bins.push((
            PathBuf::from("/usr/local/texlive/2024/bin/universal-darwin"),
            "TeX Live 2024",
        ));
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(program_files) = env::var_os("ProgramFiles") {
            let root = PathBuf::from(program_files);
            bins.push((root.join("MiKTeX/miktex/bin/x64"), "MiKTeX Program Files"));
            bins.push((root.join("texlive/2026/bin/windows"), "TeX Live 2026"));
            bins.push((root.join("texlive/2025/bin/windows"), "TeX Live 2025"));
            bins.push((root.join("texlive/2024/bin/windows"), "TeX Live 2024"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        bins.push((PathBuf::from("/usr/bin"), "Linux system PATH"));
        bins.push((
            PathBuf::from("/usr/local/texlive/2026/bin/x86_64-linux"),
            "TeX Live 2026",
        ));
        bins.push((
            PathBuf::from("/usr/local/texlive/2025/bin/x86_64-linux"),
            "TeX Live 2025",
        ));
        bins.push((
            PathBuf::from("/usr/local/texlive/2024/bin/x86_64-linux"),
            "TeX Live 2024",
        ));
    }

    bins
}

fn detect_runtime_in_bin_dir(bin_dir: &Path, source: &str) -> Option<TexRuntime> {
    if !bin_dir.is_dir() {
        return None;
    }

    let mut tools = Vec::new();
    for name in TEX_TOOLS {
        if let Some(path) = find_executable(bin_dir, name) {
            tools.push(inspect_tool((*name).to_string(), path));
        }
    }

    if tools.is_empty() {
        return None;
    }

    let distribution = infer_distribution(bin_dir, &tools, source);
    let package_manager = infer_package_manager(&tools);
    let capabilities = runtime_capabilities(&tools, &package_manager);
    let status = if capabilities.can_compile_pdf {
        TexRuntimeStatus::Available
    } else {
        TexRuntimeStatus::Partial
    };
    let root_dir = infer_root_dir(bin_dir, &distribution);
    let version = infer_runtime_version(&tools);
    let bin_dir = canonical_or_original(bin_dir)
        .to_string_lossy()
        .into_owned();

    Some(TexRuntime {
        id: stable_runtime_id(&distribution, &bin_dir),
        distribution,
        version,
        arch: std::env::consts::ARCH.into(),
        root_dir: root_dir.map(|path| path.to_string_lossy().into_owned()),
        bin_dir,
        tools,
        package_manager,
        status,
        detection_source: source.into(),
        compatible_with_host: true,
        capabilities,
    })
}

fn find_executable(bin_dir: &Path, name: &str) -> Option<PathBuf> {
    executable_candidates(name)
        .into_iter()
        .find_map(|candidate| {
            let path = bin_dir.join(candidate);
            if is_executable_file(&path) {
                Some(canonical_or_original(&path))
            } else {
                None
            }
        })
}

fn executable_candidates(name: &str) -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec![
            format!("{name}.exe"),
            format!("{name}.bat"),
            format!("{name}.cmd"),
            name.into(),
        ]
    }
    #[cfg(not(target_os = "windows"))]
    {
        vec![name.into()]
    }
}

fn is_executable_file(path: &Path) -> bool {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };
    if !metadata.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }

    #[cfg(windows)]
    {
        true
    }
}

fn inspect_tool(name: String, path: PathBuf) -> TexTool {
    match run_version_command(&path) {
        Ok(version) => TexTool {
            name,
            path: path.to_string_lossy().into_owned(),
            version,
            status: TexToolStatus::Available,
            diagnostic: None,
        },
        Err(error) => TexTool {
            name,
            path: path.to_string_lossy().into_owned(),
            version: None,
            status: TexToolStatus::VersionFailed,
            diagnostic: Some(error),
        },
    }
}

fn run_version_command(path: &Path) -> Result<Option<String>, String> {
    let mut child = Command::new(path)
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to start version command: {error}"))?;

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if start.elapsed() >= VERSION_TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("version command timed out".into());
            }
            Ok(None) => thread::sleep(Duration::from_millis(20)),
            Err(error) => return Err(format!("failed to wait for version command: {error}")),
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("failed to read version command output: {error}"))?;
    let mut bytes = output.stdout;
    if bytes.is_empty() {
        bytes = output.stderr;
    }
    bytes.truncate(MAX_VERSION_BYTES);
    let text = String::from_utf8_lossy(&bytes);
    Ok(text
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| line.trim().to_string()))
}

fn infer_distribution(bin_dir: &Path, tools: &[TexTool], source: &str) -> TexDistributionKind {
    let haystack = format!("{} {}", bin_dir.to_string_lossy(), source).to_lowercase();
    if haystack.contains("miktex")
        || tools
            .iter()
            .any(|tool| tool.name == "mpm" || tool.name == "initexmf")
    {
        TexDistributionKind::MikTex
    } else if haystack.contains("/library/tex/texbin") || haystack.contains("mactex") {
        TexDistributionKind::MacTex
    } else if haystack.contains("texlive") || tools.iter().any(|tool| tool.name == "tlmgr") {
        TexDistributionKind::TexLive
    } else {
        TexDistributionKind::Unknown
    }
}

fn infer_package_manager(tools: &[TexTool]) -> PackageManagerKind {
    if tools.iter().any(|tool| tool.name == "tlmgr") {
        PackageManagerKind::Tlmgr
    } else if tools.iter().any(|tool| tool.name == "mpm") {
        PackageManagerKind::Mpm
    } else {
        PackageManagerKind::None
    }
}

fn runtime_capabilities(
    tools: &[TexTool],
    package_manager: &PackageManagerKind,
) -> TexRuntimeCapabilities {
    let has = |name: &str| tools.iter().any(|tool| tool.name == name);
    TexRuntimeCapabilities {
        can_compile_pdf: has("latexmk") || has("pdflatex") || has("xelatex") || has("lualatex"),
        has_bibliography: has("bibtex") || has("biber"),
        has_package_manager: !matches!(package_manager, PackageManagerKind::None),
        has_synctex: has("synctex"),
    }
}

fn infer_root_dir(bin_dir: &Path, distribution: &TexDistributionKind) -> Option<PathBuf> {
    match distribution {
        TexDistributionKind::MacTex => Some(PathBuf::from("/Library/TeX")),
        TexDistributionKind::TexLive | TexDistributionKind::MikTex => {
            bin_dir.parent().map(Path::to_path_buf)
        }
        TexDistributionKind::Unknown => None,
    }
}

fn infer_runtime_version(tools: &[TexTool]) -> Option<String> {
    tools
        .iter()
        .find(|tool| {
            matches!(
                tool.name.as_str(),
                "latexmk" | "pdflatex" | "xelatex" | "lualatex"
            )
        })
        .and_then(|tool| tool.version.clone())
}

fn missing_core_tools(runtimes: &[TexRuntime]) -> Vec<String> {
    ["latexmk", "pdflatex", "xelatex", "lualatex"]
        .into_iter()
        .filter(|name| {
            !runtimes
                .iter()
                .any(|runtime| runtime.tools.iter().any(|tool| tool.name == *name))
        })
        .map(str::to_string)
        .collect()
}

fn canonical_or_original(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn stable_runtime_id(distribution: &TexDistributionKind, bin_dir: &str) -> String {
    let prefix = match distribution {
        TexDistributionKind::MacTex => "mactex",
        TexDistributionKind::TexLive => "texlive",
        TexDistributionKind::MikTex => "miktex",
        TexDistributionKind::Unknown => "unknown",
    };
    let mut slug = String::with_capacity(bin_dir.len());
    for ch in bin_dir.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    format!("{prefix}-{}", slug.trim_matches('-'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn empty_detection_reports_missing_runtime_without_shell() {
        let diagnostic = detect_tex_runtimes_from_env(None, Vec::new());

        assert_eq!(diagnostic.contract_version, 1);
        assert!(diagnostic.runtimes.is_empty());
        assert!(diagnostic
            .notes
            .iter()
            .any(|note| note.contains("does not invoke a shell")));
    }

    #[test]
    fn path_detection_groups_allowed_tex_tools_by_bin_dir() {
        let temp_dir = make_temp_dir("texforge-runtime-path");
        let script_path = temp_dir.join(test_executable_name("pdflatex"));
        write_test_executable(&script_path, "pdfTeX 3.141592653-test");

        let diagnostic =
            detect_tex_runtimes_from_env(Some(temp_dir.clone().into_os_string()), Vec::new());

        assert_eq!(diagnostic.runtimes.len(), 1);
        let runtime = &diagnostic.runtimes[0];
        assert!(runtime.capabilities.can_compile_pdf);
        assert_eq!(runtime.tools[0].name, "pdflatex");
        assert_eq!(runtime.tools[0].status, TexToolStatus::Available);
        assert!(runtime.tools[0]
            .version
            .as_deref()
            .is_some_and(|version| version.contains("pdfTeX")));

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn known_texlive_bin_infers_distribution_and_package_manager() {
        let temp_dir = make_temp_dir("texforge-runtime-texlive");
        write_test_executable(
            &temp_dir.join(test_executable_name("tlmgr")),
            "tlmgr revision 1",
        );

        let diagnostic =
            detect_tex_runtimes_from_env(None, vec![(temp_dir.clone(), "TeX Live fixture")]);

        assert_eq!(diagnostic.runtimes.len(), 1);
        assert_eq!(
            diagnostic.runtimes[0].distribution,
            TexDistributionKind::TexLive
        );
        assert_eq!(
            diagnostic.runtimes[0].package_manager,
            PackageManagerKind::Tlmgr
        );

        let _ = fs::remove_dir_all(temp_dir);
    }

    fn make_temp_dir(prefix: &str) -> PathBuf {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let dir = env::temp_dir().join(format!("{prefix}-{}-{unique}", std::process::id()));
        fs::create_dir_all(&dir).expect("temp directory should be created");
        dir
    }

    fn test_executable_name(name: &str) -> String {
        #[cfg(windows)]
        {
            format!("{name}.bat")
        }
        #[cfg(not(windows))]
        {
            name.to_string()
        }
    }

    fn write_test_executable(path: &Path, output: &str) {
        #[cfg(windows)]
        {
            let mut file = fs::File::create(path).expect("test executable should be created");
            writeln!(file, "@echo off").unwrap();
            writeln!(file, "echo {output}").unwrap();
            file.flush().unwrap();
            file.sync_all().unwrap();
        }

        #[cfg(not(windows))]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut file = fs::File::create(path).expect("test executable should be created");
            writeln!(file, "#!/bin/sh").unwrap();
            writeln!(file, "echo '{output}'").unwrap();
            file.flush().unwrap();
            file.sync_all().unwrap();
            let mut permissions = file.metadata().unwrap().permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(path, permissions).unwrap();
        }
    }
}
