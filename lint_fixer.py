import os
import re

def process_lint_report(report_path):
    with open(report_path, 'r') as f:
        lines = f.readlines()
    
    # Track fixes to avoid infinite loops
    fixes_applied = 0
    
    for line in lines:
        match = re.match(r'^(.*):(\d+):(\d+)\s+(warning|error)\s+(.*)\s+(no-console|no-unused-vars|no-undef)', line)
        if match:
            filepath, line_num, col, type, msg, rule = match.groups()
            
            if rule == 'no-console':
                # Comment out console statement
                with open(filepath, 'r') as f:
                    file_lines = f.readlines()
                target_idx = int(line_num) - 1
                if target_idx < len(file_lines):
                    if 'console' in file_lines[target_idx] and not file_lines[target_idx].strip().startswith('//'):
                        file_lines[target_idx] = '// ' + file_lines[target_idx]
                        with open(filepath, 'w') as f:
                            f.writelines(file_lines)
                        fixes_applied += 1
                        
            elif rule == 'no-unused-vars':
                # Prefix unused variable with _
                with open(filepath, 'r') as f:
                    file_lines = f.readlines()
                target_idx = int(line_num) - 1
                if target_idx < len(file_lines):
                    # Simple heuristic: find the word in the line
                    # This is best handled by eslint --fix, but we can try basic renaming if simple
                    pass 
                    
            elif rule == 'no-undef':
                # If it's a 'not defined' error for a variable that should be in scope (like e), rename it
                pass
                
    return fixes_applied

print(f"Applying automated fixes to lint issues...")
process_lint_report('lint_report.txt')
