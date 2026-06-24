import sys, re
sys.stdout.reconfigure(encoding="utf-8")

path = "D:/PycharmProject/source-writer/backend/app/utils/citation_parser.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_func = "def extract_title_from_content(content: str | None) -> str:\n    \"\"\"Extract a readable title from Dify segment markdown content.\"\"\"\n    if not content:\n        return \"\"\n    for line in content.split(\"\\n\"):\n        line = line.strip()\n        if line.startswith(\"## \"):\n            return line[3:].strip()\n        if line.startswith(\"# \"):\n            return line[2:].strip()\n    for line in content.split(\"\\n\"):\n        line = line.strip()\n        if line:\n            return line[:80] + (\"...\" if len(line) > 80 else \"\")\n    return \"\""

new_func = """HEADING_RE = re.compile(r"^(#{1,6})\\s+(.+?)(?:\\s+#*)?$", re.MULTILINE)


def extract_title_from_content(content: str | None) -> str:
    \"\"\"Extract a readable title from Dify segment markdown content.

    Looks for the first Markdown heading (any level # to ######) and returns its text.
    Falls back to the first non-empty line, truncated to 80 chars.
    Returns empty string if content is empty.
    \"\"\"
    if not content:
        return \"\"
    match = HEADING_RE.search(content)
    if match:
        return match.group(2).strip()
    # Fallback: first non-empty line
    for line in content.split(\"\\n\"):
        line = line.strip()
        if line:
            return line[:80] + (\"...\" if len(line) > 80 else \"\")
    return \"\""""

content = content.replace(old_func, new_func)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK")
