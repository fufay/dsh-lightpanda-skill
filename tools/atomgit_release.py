#!/usr/bin/env python3
"""创建 AtomGit release 并上传附件（API v5，签名两步法）。
用 curl 做 HTTP（本机 python 缺 CA 证书，curl 正常）。
用法: atomgit_release.py --repo Kevin911/dsh-lightpanda-skill --tag TAG [--name N] [--body-file F] --assets DIR
环境: ATOMGIT_TOKEN 或 --token-file
"""
import argparse, json, os, subprocess, sys, tempfile, urllib.parse

API = 'https://api.atomgit.com/api/v5'
CURL = 'curl'

def curl(args, timeout=1800):
    p = subprocess.run([CURL, '-sS', '--max-time', str(timeout)] + args, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr

def api_json(method, url, token, data=None, timeout=120):
    args = ['-X', method, url, '-H', f'PRIVATE-TOKEN: {token}', '-H', 'Accept: application/json']
    tmp = None
    if data is not None:
        tmp = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8')
        json.dump(data, tmp, ensure_ascii=False)
        tmp.close()
        args += ['-H', 'Content-Type: application/json', '--data-binary', '@' + tmp.name]
    try:
        rc, out, err = curl(args, timeout=timeout)
    finally:
        if tmp: os.unlink(tmp.name)
    if rc != 0:
        raise RuntimeError(f'curl failed rc={rc}: {err[:300]}')
    return json.loads(out) if out.strip() else {}

def api_status(url, token):
    rc, out, err = curl(['-o', '/dev/null', '-w', '%{http_code}', url, '-H', f'PRIVATE-TOKEN: {token}'], timeout=60)
    return rc, out.strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--tag', required=True)
    ap.add_argument('--name', default=None)
    ap.add_argument('--body-file', default=None)
    ap.add_argument('--assets', required=True)
    ap.add_argument('--token-file', default=os.environ.get('ATOMGIT_TOKEN_FILE'))
    a = ap.parse_args()
    token = os.environ.get('ATOMGIT_TOKEN') or (open(a.token_file).read().strip() if a.token_file else '')
    if not token: sys.exit('缺少 ATOMGIT_TOKEN / ATOMGIT_TOKEN_FILE')
    body = open(a.body_file, encoding='utf-8').read() if a.body_file else ''
    name = a.name or a.tag
    base = f"{API}/repos/{a.repo}"
    tag_q = urllib.parse.quote(a.tag, safe='')

    rc, code = api_status(f"{base}/releases/tags/{tag_q}", token)
    if code == '200':
        print(f'[atomgit] release {a.tag} 已存在，跳过创建')
    else:
        r = api_json('POST', f"{base}/releases", token,
                     {'tag_name': a.tag, 'target_commitish': 'main', 'name': name, 'body': body})
        print(f'[atomgit] release 创建: {r.get("html_url") or r.get("url") or "ok"}')

    for fn in sorted(os.listdir(a.assets)):
        p = os.path.join(a.assets, fn)
        if not os.path.isfile(p): continue
        size = os.path.getsize(p)
        print(f'[atomgit] 上传 {fn} ({size} bytes) ...', flush=True)
        q = urllib.parse.quote(fn, safe='')
        up = api_json('GET', f"{base}/releases/{tag_q}/upload_url?file_name={q}", token)
        url, headers = up['url'], up.get('headers') or {}
        args = ['-X', 'PUT', url, '--data-binary', '@' + p, '-H', 'Content-Length: ' + str(size)]
        for k, v in headers.items():
            args += ['-H', f'{k}: {v}']
        rc, out, err = curl(args, timeout=3600)
        if rc != 0:
            sys.exit(f'[atomgit] 上传失败 {fn}: {err[:400]}')
        print(f'[atomgit] OK {fn}', flush=True)
    print('[atomgit] 完成')

if __name__ == '__main__':
    main()
