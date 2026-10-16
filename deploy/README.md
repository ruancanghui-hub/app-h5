# 部署说明 —— App H5

## 线上信息

| 项目 | 值 |
|---|---|
| 访问地址 | **https://h5.aigrowpark.com/** |
| 服务器 | `139.199.211.157`（腾讯云轻量，广州六区，OpenCloudOS 9.2） |
| 站点目录 | `/www/wwwroot/h5.aigrowpark.com` |
| Nginx | 编译安装于 `/usr/local/nginx`，站点配置在 `conf/sites/` |
| 备份目录 | `/root/deploy-backup/<时间戳>/` |

## 发布流程（日常更新）

```bash
cd /Users/orico/Documents/01_project/60_app_h5

# 1. 构建（必须用 arm64 node，详见下方「已知坑」）
export PATH="/opt/homebrew/bin:$PATH"
/opt/homebrew/bin/node /Users/orico/.local/lib/node_modules/pnpm/bin/pnpm.cjs build

# 2. 上传
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
export SSH_BIND=$(ipconfig getifaddr en1)   # 绕过本机 TUN 代理，详见「已知坑」
cd deploy
STAMP=$(date +%Y%m%d-%H%M%S)
SSH_PW='<密码>' expect ./scp-pass.exp ../dist root@139.199.211.157:/root/deploy-work/dist-$STAMP

# 3. 发布（保留 releases 历史版本）
SSH_PW='<密码>' expect ./ssh-pass.exp 139.199.211.157 \
  "rsync -a --delete /root/deploy-work/dist-$STAMP/ /www/wwwroot/h5.aigrowpark.com/"
```

> 静态资源带 hash，`index.html` 已配置不缓存，直接覆盖即可，**无需 reload nginx**。

## 证书续期

`acme.sh` 已装好并注册了定时任务（每天 02:49 / 08:49 / 14:49 / 20:49 检查），
到期前会自动续期并自动 reload nginx，**正常情况下不需要人工干预**。

```bash
# 查看证书状态与下次续期时间
/root/.acme.sh/acme.sh --list

# 手动强制续期
/root/.acme.sh/acme.sh --renew -d h5.aigrowpark.com --force --ecc
```


## 目录结构

```
deploy/
├── ssh-pass.exp              密码登录封装（本机无 sshpass，用 expect 实现）
├── scp-pass.exp              密码上传封装
├── nginx-aigrowpark.conf     H5 站点 Nginx 配置参考
└── remote/                   一次性初始化脚本（已执行过，留档备查）
    ├── setup-nginx.sh        备份配置 + 写入 sites + 注入 include
    ├── migrate-and-start.sh  端口迁移 + 启动 Nginx（带自动回滚）
    ├── build-nginx-ssl.sh    重编译 Nginx 补 SSL 模块
    └── enable-ssl.sh         签发证书 + 启用 443
```

## 服务器架构

```
Internet → Nginx (:80 / :443)
             ├─ aigrowpark.com / www  → 反向代理 127.0.0.1:3001  (idea-website, Next.js)
             └─ h5.aigrowpark.com     → 静态文件 /www/wwwroot/h5.aigrowpark.com
```

原 `idea-website` 直接监听 80，为让 Nginx 接管 80/443 已迁至 **3001**（pm2 管理）。
该服务器为**多项目共用生产机**，`/code/` 下还有多个 pm2 应用，改动前请先探测端口占用。

## 已知坑

1. **本机构建必须用 arm64 node**
   本机 `pnpm` 跑在 Rosetta x64 的 node 下，而 `node_modules` 装的是 arm64 版 rollup，
   直接用 `pnpm build` 会报 `Cannot find module '@rollup/rollup-darwin-x64'`。
   解法见上方构建命令。

2. **编译安装的 Nginx 默认没有 SSL 模块**
   原 `/usr/local/nginx/sbin/nginx` 的 `configure arguments` 只有 `--prefix`，
   加 `ssl_certificate` 会报 `the "ssl" parameter requires ngx_http_ssl_module`。
   已通过 `remote/build-nginx-ssl.sh` 用相同 prefix 重编译并原地替换二进制解决。

3. **本机代理会阻断 SSH**
   TUN 模式代理（fake-IP 段 `198.18.0.0/15`）会劫持到该服务器的全部流量，表现为
   `kex_exchange_identification: Connection closed by remote host`。

   两个办法，任选其一：
   - 关掉代理软件（含 TUN 模式）
   - **不关代理也能连**：绑定物理网卡源地址绕过 TUN
     ```bash
     export SSH_BIND=$(ipconfig getifaddr en1)   # 如 192.168.1.208
     ```
     `ssh-pass.exp` / `scp-pass.exp` 支持该变量，会转成 `ssh -o BindAddress=...`。
     注意：`sudo route add` 需要 root，沙箱环境下不可用，所以走 BindAddress 这条路。

4. **Nginx 的 `location ~ /\.` 会拦掉 ACME 验证路径**
   为保护 `.env` 之类的隐藏文件写的 `location ~ /\. { deny all; }`，会把
   `/.well-known/acme-challenge/` 一起拒掉，导致 Let's Encrypt 验证返回 **403**。
   必须在正则 location **之前**放一条使用 `^~` 前缀的例外：
   ```nginx
   location ^~ /.well-known/acme-challenge/ {
       root /www/wwwroot/h5.aigrowpark.com;
       allow all;
   }
   ```
   `^~` 前缀匹配优先于正则匹配，所以能正确覆盖 `deny` 规则。
   （该例外在 `sites/h5.aigrowpark.com.conf` 的 HTTP 与 HTTPS 两个 server 块里都有。）

5. **本机 curl 会被代理干扰**
   诊断时可用 `--resolve` 强制指定 IP：
   ```bash
   curl -s --resolve h5.aigrowpark.com:443:139.199.211.157 https://h5.aigrowpark.com/
   ```


## 回滚

```bash
# Nginx 配置回滚
cp -a /root/deploy-backup/<时间戳>/nginx.conf.bak /usr/local/nginx/conf/nginx.conf
/usr/local/nginx/sbin/nginx -t && /usr/local/nginx/sbin/nginx -s reload

# Nginx 二进制回滚（若 SSL 版本出问题）
cp -a /root/deploy-backup/nginx-binary-<时间戳>/nginx.original /usr/local/nginx/sbin/nginx
/usr/local/nginx/sbin/nginx -s stop && /usr/local/nginx/sbin/nginx

# 站点文件回滚
cp -a /www/wwwroot/h5.aigrowpark.com/releases/<时间戳>/ /www/wwwroot/h5.aigrowpark.com/
```
