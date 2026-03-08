@echo off
gcloud run services describe cms-web --project cms-web-488112 --region asia-northeast3 > tmp_cloud_run_status.txt 2>&1
