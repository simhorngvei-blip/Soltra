import os
import json
import glob

brain_dir = r"C:\Users\reine\.gemini\antigravity\brain"
output_file = r"D:\Soltra\history_summary.txt"

transcripts = glob.glob(os.path.join(brain_dir, "*", ".system_generated", "logs", "transcript.jsonl"))

events = []

for t_path in transcripts:
    conv_id = t_path.split(os.sep)[-4]
    with open(t_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                data = json.loads(line)
                
                # Extract any tool calls
                if "tool_calls" in data:
                    for tc in data["tool_calls"]:
                        name = tc.get("name", "")
                        args = tc.get("arguments", {})
                        
                        if "write_to_file" in name or "replace_file_content" in name:
                            target = args.get("TargetFile", "unknown")
                            if "Soltra" in target or "soltra" in target.lower():
                                events.append(f"[{conv_id}] {name} | {target}")
                                
                        elif "run_command" in name:
                            cmd = args.get("CommandLine", "unknown")
                            if "soltra" in cmd.lower():
                                events.append(f"[{conv_id}] run_command | {cmd}")
                                
                # Also extract text mentions of Soltra in the model responses
                elif data.get("source") == "MODEL" and data.get("type") == "TEXT":
                    content = data.get("content", "")
                    if "Soltra" in content:
                        # Grab just a snippet
                        snippet = content[:100].replace('\n', ' ')
                        events.append(f"[{conv_id}] MODEL TEXT | {snippet}...")
            except Exception as e:
                pass

with open(output_file, "w", encoding="utf-8") as out:
    for e in events:
        out.write(e + "\n")

print(f"Extracted {len(events)} events.")
