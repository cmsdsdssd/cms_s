@echo off
git status --short --branch > tmp_git_status.txt 2>&1
git diff --stat > tmp_git_diff.txt 2>&1
git diff --staged --stat > tmp_git_diff_staged.txt 2>&1
git log -30 --pretty=format:%%s > tmp_git_log.txt 2>&1
git rev-parse --abbrev-ref HEAD > tmp_git_branch.txt 2>&1
git rev-parse --abbrev-ref @{upstream} > tmp_git_upstream.txt 2>&1
git rev-list --left-right --count origin/main...HEAD > tmp_git_ahead_behind.txt 2>&1
