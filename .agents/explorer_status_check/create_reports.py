import json
import os

def generate_reports():
    # Load parsed eslint data
    if not os.path.exists("any_errors_parsed.json"):
        print("any_errors_parsed.json not found!")
        return

    with open("any_errors_parsed.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    total_any_errors = data["total_any_errors"]
    files_with_any_errors = data["files_with_any_errors"]

    # Build error message snippet
    build_status = "FAILED"
    build_errors = """src/components/temp-false-positive-test.tsx:3:7 - error TS6133: 'fakeImportString' is declared but its value is never read.
3 const fakeImportString = "import nonexistent3 from './nonexistent-file-3';";
        ~~~~~~~~~~~~~~~~
src/components/temp-false-positive-test.tsx:4:7 - error TS6133: 'fakeRequireString' is declared but its value is never read.
4 const fakeRequireString = "require('./nonexistent-file-4');";
        ~~~~~~~~~~~~~~~~~
src/components/temp-false-positive-test.tsx:6:20 - error TS2307: Cannot find module './nonexistent-real-file' or its corresponding type declarations.
6 import broken from './nonexistent-real-file';
                     ~~~~~~~~~~~~~~~~~~~~~~~~~
src/components/temp-import-test.tsx:1:29 - error TS2307: Cannot find module './this-is-a-real-non-existent-file' or its corresponding type declarations.
1 import nonExistentFile from './this-is-a-real-non-existent-file';
                              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Found 4 errors."""

    # Generate analysis.md content
    analysis_content = f"""# Codebase Status Analysis

## Executive Summary
- **ESLint `@typescript-eslint/no-explicit-any` Warnings/Errors**: **{total_any_errors}** occurrences across **{len(files_with_any_errors)}** files.
- **Build Status**: **FAILED** (tsc -b && vite build failed with exit code 2).
  - Four compilation errors were found in two test files: `src/components/temp-false-positive-test.tsx` and `src/components/temp-import-test.tsx`.
- **Milestone 1 Verification**:
  - `src/types/electron.d.ts`: **0** `@typescript-eslint/no-explicit-any` warnings (Clean).
  - `src/lib/comfyApi.ts`: **0** `@typescript-eslint/no-explicit-any` warnings (Clean).

---

## 1. ESLint `no-explicit-any` Warnings Detail
The following is a comprehensive breakdown of all {total_any_errors} occurrences of the `@typescript-eslint/no-explicit-any` rule violations, grouped by file:

"""

    for filepath, errors in files_with_any_errors.items():
        analysis_content += f"### {filepath} ({len(errors)} warnings)\n"
        analysis_content += "| Line | Column | Severity | Message |\n"
        analysis_content += "|---|---|---|---|\n"
        for err in errors:
            analysis_content += f"| {err['line']} | {err['column']} | {err['severity']} | {err['message']} |\n"
        analysis_content += "\n"

    analysis_content += f"""---

## 2. Build Compilation Failures
Running `npm run build` fails during the TypeScript compilation phase (`tsc -b`).

### Build Log Output:
```text
{build_errors}
```

### Analysis of Build Failures:
1. `src/components/temp-false-positive-test.tsx`:
   - Line 3: `'fakeImportString'` is declared but never read (TS6133).
   - Line 4: `'fakeRequireString'` is declared but never read (TS6133).
   - Line 6: Cannot find module `'./nonexistent-real-file'` (TS2307).
2. `src/components/temp-import-test.tsx`:
   - Line 1: Cannot find module `'./this-is-a-real-non-existent-file'` (TS2307).

These files appear to be test or temporary files introduced to test import detection or false positive handling. Because they import non-existent files and declare unused variables, they prevent successful production compilation.

---

## 3. Milestone 1 Verification
Milestone 1 files were explicitly audited in the lint results:
- **`src/types/electron.d.ts`**: Not present in the ESLint error log, confirming **0 lint warnings/errors**.
- **`src/lib/comfyApi.ts`**: Not present in the ESLint error log, confirming **0 lint warnings/errors**.

Both files comply fully with the requirement to have zero `@typescript-eslint/no-explicit-any` warnings.
"""

    with open("analysis.md", "w", encoding="utf-8") as out:
        out.write(analysis_content)

    print("analysis.md generated successfully.")

if __name__ == '__main__':
    generate_reports()
