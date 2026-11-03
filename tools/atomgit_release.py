#!/usr/bin/env python3
"""创建 AtomGit release 并上传附件（API v5，签名两步法）。
用法: atomgit_release.py --repo Kevin911/dsh-lightpanda-skill --tag TAG --name NAME --body-file F --assets DIR
环境: ATOMGIT_TOKEN 或 --token-file
"""
import argparse, json, os, sys, urllib.request, urllib.parse, urllib.error

API = 'https://api.atomgit.com/api/v5'

def call(method, url, token, data=None, headers=None, raw=False, timeout=300):
    h = {'PRIVATE-TOKEN': token}
    if headers: h.update(headers)
    body = None
    if data is not None:
        if raw:
            body = data
        else:
            body = json.dumps(data).encode()
            h.setdefault('Content-Type', 'application/json')
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        content = r.read()
        return r.status, (content if raw else (json.loads(content) if content else {}))

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
    # 1) release 已存在？
    try:
        call('GET', f"{base}/releases/tags/{urllib.parse.quote(a.tag)}", token)
        print(f'[atomgit] release {a.tag} 已存在，跳过创建')
    except urllib.error.HTTPError as e:
        if e.code != 404: raise
        st, r = call('POST', f"{base}/releases", token,
                     {'tag_name': a.tag, 'target_commitish': 'main', 'name': name, 'body': body})
        print(f'[atomgit] release 创建: {r.get("html_url") or r.get("url") or st}')
    # 2) 逐个上传
    files = sorted(os.listdir(a.assets))
    for fn in files:
        p = os.path.join(a.assets, fn)
        if not os.path.isfile(p): continue
        size = os.path.getsize(p)
        st, up = call('GET', f"{base}/releases/{urllib.parse.quote(a.tag)}/upload_url?file_name={urllib.parse.quote(fn)}", token)
        url = up['url']; headers = up.get('headers') or {}
        print(f'[atomgit] 上传 {fn} ({size} bytes)')
        with open(p, 'rb') as f:
            data = f.read()
        st, _ = call('PUT', url, token, data=data, headers=headers, raw=True, timeout=1800)
        print(f'[atomgit] OK {fn} → {st}')

if __name__ == '__main__':
    main()
