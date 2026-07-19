import re
import os
import json

def parse_eslint_log(log_path):
    if not os.path.exists(log_path):
        print(f"Log file not found at {log_path}")
        return

    with open(log_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    current_file = None
    all_any_errors = []
    
    # We want to match file paths starting with /home/doodcom/Documents/Vortex Agentic V2/
    # It might end with a line number and column number like :37:21
    file_prefix = "/home/doodcom/Documents/Vortex Agentic V2/"
    
    # Pattern to match ESLint error/warning lines
    # Example: "  53:32   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any"
    error_pattern = re.compile(r'^\s*(\d+):(\d+)\s+(error|warning)\s+(.*?)\s+(\S+)\s*$')

    for line in lines:
        line_str = line.strip('\r\n')
        
        # Check if line is a file path header
        if line_str.startswith(file_prefix):
            # Clean up the line
            path_part = line_str[len(file_prefix):]
            # Strip trailing line/col info if present (e.g. :37:21)
            # Find the file extension (.tsx, .ts, .js, .jsx, etc.) and strip everything after
            ext_match = re.search(r'\.(tsx|ts|jsx|js|d\.ts)', path_part)
            if ext_match:
                end_idx = ext_match.end()
                current_file = path_part[:end_idx]
            else:
                current_file = path_part
            continue
            
        # Match ESLint error/warning
        match = error_pattern.match(line_str)
        if match and current_file:
            line_no = int(match.group(1))
            col_no = int(match.group(2))
            severity = match.group(3)
            message = match.group(4).strip()
            rule = match.group(5)
            
            if rule == "@typescript-eslint/no-explicit-any":
                all_any_errors.append({
                    "file": current_file,
                    "line": line_no,
                    "column": col_no,
                    "severity": severity,
                    "message": message
                })

    # Group by file
    grouped = {}
    for err in all_any_errors:
        f = err["file"]
        if f not in grouped:
            grouped[f] = []
        grouped[f].append(err)

    # Sort files and their errors
    sorted_grouped = {}
    for f in sorted(grouped.keys()):
        sorted_grouped[f] = sorted(grouped[f], key=lambda x: x["line"])

    result = {
        "total_any_errors": len(all_any_errors),
        "files_with_any_errors": sorted_grouped
    }

    with open("any_errors_parsed.json", "w", encoding="utf-8") as out:
        json.dump(result, out, indent=2)

    print(f"Parsed {len(all_any_errors)} 'any' errors across {len(sorted_grouped)} files.")

if __name__ == '__main__':
    log_path = "/home/doodcom/.gemini/antigravity-cli/brain/f71997f9-6126-4dbc-8c53-2e44a4b21b7c/.system_generated/tasks/task-13.log"
    parse_eslint_log(log_path)
