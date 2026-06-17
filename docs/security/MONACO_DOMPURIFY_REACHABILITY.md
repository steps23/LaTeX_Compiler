# Monaco Editor & DOMPurify Reachability Analysis

This report documents the exact reachability of the 15 DOMPurify-related CVEs/Advisories inside `monaco-editor@0.55.1` used by TeXForge, based on an audit of the editor's live sources installed in `node_modules/monaco-editor/`.

---

## 1. Source-Code Origin of DOMPurify Usage

In `monaco-editor@0.55.1`, DOMPurify is isolated and configured primarily in the base browser module:
- **Source File**: `node_modules/monaco-editor/esm/vs/base/browser/domSanitize.js`
- **Imports**: `import purify from './dompurify/dompurify.js';`

All internal rendering of markdown, hovers, helper popups, and hover tooltips passes through the wrapper function `doSanitizeHtml(untrusted, config, outputType)`.

---

## 2. Configuration Analysis of DOMPurify Options

The following table documents how Monaco Editor invokes the `purify.sanitize` API and which standard configuration flags are used:

| Configuration Property | Used? | Exact Line / Configuration Value in ESM Sources |
| :--- | :---: | :--- |
| `ALLOWED_TAGS` | **Yes** | Driven by a custom static list `basicMarkupHtmlTags` containing standard markup elements (e.g., `'a'`, `'div'`, `'p'`, `'span'`, `'code'`). Form/script/interactive elements are strictly omitted. Can be augmented of overridden dynamically at run time via `config.allowedTags`. |
| `ALLOWED_ATTR` | **Yes** | Driven by a custom static list `defaultAllowedAttrs` containing harmless attributes (e.g., `'href'`, `'alt'`, `'title'`). Adjusted to lower-case dynamically. Can be overridden via `config.allowedAttributes`. |
| `ALLOW_UNKNOWN_PROTOCOLS` | **Yes** | Hardcoded to `true` inside `defaultDomPurifyConfig`. Link protocol filtering is deferred to custom hooks. |
| `SAFE_FOR_XML` | **No** | Not configured or referenced in `domSanitize.js`. |
| `SAFE_FOR_TEMPLATES` | **No** | Not configured or referenced in `domSanitize.js`. |
| `RETURN_DOM` | **No** | Not configured or referenced in `domSanitize.js`. |
| `RETURN_DOM_FRAGMENT` | **Yes** | Hardcoded to `true` when DOM fragment output is requested (Line 236):<br>`purify.sanitize(untrusted, { ...resolvedConfig, RETURN_DOM_FRAGMENT: true })` |
| `RETURN_TRUSTED_TYPE` | **Yes** | Hardcoded to `true` when standard sanitized Trusted type HTML is requested (Line 242):<br>`purify.sanitize(untrusted, { ...resolvedConfig, RETURN_TRUSTED_TYPE: true })` |
| `IN_PLACE` | **No** | Not configured or referenced in `domSanitize.js`. Inline mutations on nodes are handled via container resets. |
| `USE_PROFILES` | **No** | Not configured or referenced in `domSanitize.js`. Profiling constraints are ignored. |
| `ADD_ATTR` / `ADD_TAGS` | **No** | Not utilized directly as native DOMPurify configurations; custom markup augmentations are processed dynamically via Monaco's JS logic preceding the sanitize invoke. |
| `FORBID_ATTR` / `FORBID_TAGS`| **No** | Not utilized directly as native DOMPurify configurations. |
| `clearConfig` | **No** | `purify.clearConfig` is not utilized. Reconfiguration isolates are cleaned up via `purify.removeAllHooks()` in the `finally` block of `doSanitizeHtml`. |
| **Trusted Types Policy** | **Yes** | Configured dynamically if supported by the browser context. |
| **Iframe / Cross-Realm** | **No** | DOMPurify is invoked within the main execution realm. No inter-frame interactions are configured. |

### DOMPurify Hooks registered in Monaco Base:
1. `afterSanitizeAttributes`: Always registered to execute `hookDomPurifyHrefAndSrcSanitizer` in order to clean up or strip restricted protocols (standardizing Link protocols to `http` or `https` and blocking scripts like `javascript:`).
2. `uponSanitizeElement`: Registered dynamically if `config.replaceWithPlaintext` is set to map unrecognized tags into plain text blocks.
3. `uponSanitizeAttribute`: Registered dynamically if custom attribute validation predicates (`config.allowedAttributes.shouldKeep`) are supplied.

---

## 3. Potential Input Channels and Origins

Monaco Editor pipes HTML strings into `sanitizeHtml` or `safeSetInnerHtml` from several sources:
- **Markdown Comments**: Document header/hover documentation (via `markdownRenderer.js` calling marked converter output to HTML).
- **Diagnostics & Hovers**: Code diagnostic lint messages, TypeScript/LSP type declarations, and documentation hovers.
- **AI / Provider plugin layers**: Extensible completions or hover panels, which might inject Rich Text formatted text depending on third-party plugin extensions.

---

## 4. Rigorous Mapping of the 15 DOMPurify Advisories

Using our verified ESM audit, we map the 15 DOMPurify advisories into rigorous reachability classifications:

### Group A: Non-Applicable
*No component or configuration path supporting these attributes exists inside the project or Monaco.*

1. **GHSA-cjmm-f4jc-qw8r (URI bypass on `ADD_ATTR`)**
   - *Classification*: `Non applicabile`
   - *Technical Justification*: Monaco does not configure the native DOMPurify `ADD_ATTR` parameter, resorting to dynamic static array updates instead.
2. **GHSA-cj63-jhhr-wcxv (Prototype Pollution on `USE_PROFILES`)**
   - *Classification*: `Non applicabile`
   - *Technical Justification*: Monaco does not use the `USE_PROFILES` configuration anywhere in its wrappers.
3. **GHSA-39q2-94rc-95cp (Early exit bypass on `ADD_TAGS`)**
   - *Classification*: `Non applicabile`
   - *Technical Justification*: Monaco does not configure the native `ADD_TAGS` or `FORBID_TAGS` properties.
4. **GHSA-h7mw-gpvr-xq4m / CVE-2026-41240 (ADD_TAGS function-based evaluation asymmetry)**
   - *Classification*: `Non applicabile`
   - *Technical Justification*: Function-based programmatic tags manipulation is not configured at the DOMPurify API boundary.
5. **GHSA-gvmj-g25r-r7wr (Tag template escapes on `SAFE_FOR_TEMPLATES`)**
   - *Classification*: `Non applicabile`
   - *Technical Justification*: `SAFE_FOR_TEMPLATES` is completely absent from Monaco's initialization configs.
6. **GHSA-vxr8-fq34-vvx9 (Trusted Type Policy leak on `clearConfig`)**
   - *Classification*: `Non applicabile`
   - *Technical Justification*: `purify.clearConfig()` is never executed by the editor.

### Group B: Non-Observed in the Current Path
*The vulnerable configurations are partially present or configurations are pre-requisites, but no exploits can be constructed under our architecture.*

7. **GHSA-crv5-9vww-q3g8 / CVE-2026-41239 (Bypass with `SAFE_FOR_TEMPLATES` and `RETURN_DOM_FRAGMENT`)**
   - *Classification*: `Non osservato nel percorso corrente`
   - *Technical Justification*: While Monaco uses `RETURN_DOM_FRAGMENT` to construct UI snippets, `SAFE_FOR_TEMPLATES` is not enabled, and neither Monaco's hover containers nor our React wrapper compiles or evaluates interpolations on the resulting fragments.
8. **GHSA-v9jr-rg53-9pgp / CVE-2026-41238 (Prototype Pollution in `CUSTOM_ELEMENT_HANDLING`)**
   - *Classification*: `Non osservato nel percorso corrente`
   - *Technical Justification*: Although standard Prototype Pollution pathways are blocked because the host project does not execute custom elements fallback rendering, complete non-reachability depends on continuous dependency hygiene.
9. **GHSA-h8r8-wccr-v5f2 (mXSS re-contextualization)**
   - *Classification*: `Non osservato nel percorso corrente`
   - *Technical Justification*: Restricted to specific HTML/XML browser-level rendering permutations. The hover views only display structured basics, but validation requires dedicated browser interaction testing.
10. **GHSA-x4vx-rjvf-j5p4 (Script tag lingering in `IN_PLACE`)**
    - *Classification*: `Non osservato nel percorso corrente`
    - *Technical Justification*: `IN_PLACE` is not utilized.
11. **GHSA-76mc-f452-cxcm (Global allowedTags mutating via Hooks)**
    - *Classification*: `Non osservato nel percorso corrente`
    - *Technical Justification*: While hooks are heavily used by Monaco, they are strictly removed via `removeAllHooks()` in the `finally` block of each sanitiation, preventing cumulative configuration poisoning.
12. **GHSA-hpcv-96wg-7vj8 (Cross-realm `instanceof` bypass in `IN_PLACE`)**
    - *Classification*: `Non osservato nel percorso corrente`
    - *Technical Justification*: No cross-realm or iframe-isolated rendering pipelines have been configured for DOMPurify inside Monaco.
13. **GHSA-r47g-fvhr-h676 (DOM Clobbering in `IN_PLACE` root tags)**
    - *Classification*: `Non osservato nel percorso corrente`
    - *Technical Justification*: `IN_PLACE` is not utilized.
14. **GHSA-rp9w-3fw7-7cwq (Shadow Root inside `<template>`)**
    - *Classification*: `Non osservato nel percorso corrente`
    - *Technical Justification*: No template tag shadow trees are injected via LaTeX hovers, though absolute safety is unproven without interaction testing.
15. **GHSA-v2wj-7wpq-c8vv / CVE-2026-0540 (Mismatched raw-text elements in `SAFE_FOR_XML`)**
    - *Classification*: `Non osservato nel percorso corrente`
    - *Technical Justification*: Monaco base does not configure custom `SAFE_FOR_XML` sanitization, but full confirmation requires specialized verification.

---

## 5. Summary and Conclusion

Our source audit confirms that the DOMPurify API integration inside Monaco Editor is engineered safely with extreme defensive constraints (disabling forms/scripts, stripping non-standard schemas, and cleaning up hooks after each call). 

However, since Monaco Editor delegates sanitization of hover elements and markdown text directly to DOMPurify, **the absence of exploitability is not a proof of non-reachability**. Definitive verification will require dedicated end-to-end security penetration tests simulating malicious nested structures.
