import urllib.request
import json
import subprocess
import os

TOKEN = "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"
USERNAME = "naveensalvi213"
REPO_NAME = "x-ai-automation"

# 1. Create GitHub Repository via API
url = "https://api.github.com/user/repos"
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "PythonScript"
}
data = json.dumps({
    "name": REPO_NAME,
    "description": "X (Twitter) Scraper & Gemini 3.6 AI Lead Qualification System",
    "private": True
}).encode("utf-8")

req = urllib.request.Request(url, data=data, headers=headers, method="POST")

try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode("utf-8"))
        print(f"✅ Repository created: {res.get('html_url')}")
except Exception as e:
    print(f"Notice (Repo might already exist): {e}")

# 2. Configure Git Remote and Push
repo_url = f"https://{USERNAME}:{TOKEN}@github.com/{USERNAME}/{REPO_NAME}.git"

def run_git(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(f"Git command: {cmd}")
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)

run_git("git init")
run_git("git config user.name 'naveensalvi213'")
run_git("git config user.email 'naveensalvi213@github.user'")
run_git("git remote remove origin")
run_git(f"git remote add origin {repo_url}")
run_git("git checkout -b main")
run_git("git add .")
run_git("git commit -m 'Initial commit: X Scraper + Gemini 3.6 Lead Qualification + Red/Black Mobile App'")
run_git("git push -u origin main --force")

print("🎉 PUSH TO GITHUB COMPLETE!")
