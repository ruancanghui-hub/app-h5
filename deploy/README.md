# 部署说明 —— App H5

## 线上信息

| 项目 | 值 |
|---|---|
| 客户端页面 | **https://h5.aigrowpark.com/** |
| 运营后台 | **https://h5.aigrowpark.com/admin**（basic auth 保护） |
| 服务器 | `139.199.211.157`（腾讯云轻量，广州六区，OpenCloudOS 9.2） |
| 站点目录 | `/www/wwwroot/h5.aigrowpark.com` |
| API 后端目录 | `/www/wwwroot/h5.aigrowpark.com-api`（pm2 应用 `app-h5-api`，监听 `127.0.0.1:3900`） |
| 数据目录 | `/www/wwwroot/h5.aigrowpark.com-api/data/`（`feedbacks.json` + `uploads/`） |
| Nginx | 编译安装于 `/usr/local/nginx`，站点配置在 `conf/sites/` |
| 口令文件 | `/etc/nginx/htpasswd`（**不能放 `/usr/local/nginx/conf/`**，原因见「已知坑 6」） |
| 备份目录 | `/root/deploy-backup/<时间戳>/` |

## 架构

```
Internet → Nginx (:80 / :443)
             ├─ aigrowpark.com / www  → 反代 127.0.0.1:3001  (idea-website, Next.js)
             └─ h5.aigrowpark.com
                  ├─ /            → 静态 /www/wwwroot/h5.aigrowpark.com        (公开)
                  ├─ /admin       → 同上，admin.html                            (需密码)
                  ├─ /api/ops/*   → 反代 127.0.0.1:3900                         (需密码)
                  └─ /api/*       → 反代 127.0.0.1:3900                         (公开)
```

**关键点：这个工程不是纯静态的。** 前端有两个接口依赖：

| 接口 | 用途 | 保护 |
|---|---|---|
| `POST /api/feedback` | 客户端提交反馈（multipart，含图片） | 公开 |
| `GET /api/ops/feedbacks` | 运营页读取反馈列表 | basic auth |
| `GET /api/ops/uploads/:name` | 运营页查看截图 | basic auth |
| `GET /api/health` | 健康检查 | 公开 |

开发时这些接口由 `vite.config.ts` 里的 `feedbackApiPlugin` 中间件承载，**只对 dev server 生效**。
生产环境由 `server/prod-server.ts` 打包成的独立 Node 服务提供，pm2 托管。

## 发布流程

一键发布（推荐）：

```bash
cd /Users/orico/Documents/01_project/60_app_h5
SSH_PW='<服务器 root 密码>' bash deploy/publish.sh
```

`publish.sh` 会依次完成：构建前端（双入口）→ 用 esbuild 打包 API → 上传 → 远端同步静态文件
→ reload API → 外网验证。首次部署运营后台时加 `--init-ops` 参数安装 Nginx 配置与口令。

手动分步（排查问题用）：

```bash
cd /Users/orico/Documents/01_project/60_app_h5

# 1. 构建（必须用 arm64 node，见「已知坑 1」）
export PATH="/opt/homebrew/bin:$PATH"
/opt/homebrew/bin/node /Users/orico/.local/lib/node_modules/pnpm/bin/pnpm.cjs build

# 2. 打包 API 后端
ESB=node_modules/.pnpm/@esbuild+darwin-arm64@0.25.12/node_modules/@esbuild/darwin-arm64/bin/esbuild
"$ESB" server/prod-server.ts --bundle --platform=node --target=node20 \
  --format=cjs --outfile=deploy/out/prod-server.cjs

# 3. 上传
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy all_proxy ALL_PROXY
export SSH_BIND=$(ipconfig getifaddr en1)   # 绕过本机 TUN 代理，见「已知坑 3」
cd deploy
STAMP=$(date +%Y%m%d-%H%M%S)
SSH_PW='<密码>' expect ./ssh-pass.exp 139.199.211.157 'mkdir -p /root/deploy-work'
SSH_PW='<密码>' expect ./scp-pass.exp ../dist root@139.199.211.157 /root/deploy-work/dist-$STAMP
SSH_PW='<密码>' expect ./scp-pass.exp ./out/prod-server.cjs root@139.199.211.157 /root/deploy-work/
SSH_PW='<密码>' expect ./scp-pass.exp ./remote/deploy-site.sh root@139.199.211.157 /root/deploy-work/
SSH_PW='<密码>' expect ./scp-pass.exp ./remote/api-ecosystem.json root@139.199.211.157 /root/deploy-work/

# 4. 远端同步（自动备份当前版本，仅保留最近 3 个）
SSH_PW='<密码>' expect ./ssh-pass.exp 139.199.211.157 "bash /root/deploy-work/deploy-site.sh $STAMP"
```

> 静态资源带 hash、`index.html`/`admin.html` 已配置不缓存，**覆盖即可生效，不用 reload nginx**。
> 只有改动 API 代码时才需要重启后端，`deploy-site.sh` 会自动 reload pm2。

## 运营后台

- 地址：`https://h5.aigrowpark.com/admin`
- 用户名：`admin`
- 密码：**用户自定义，未记录在文档中**（曾于 2026-10-16 按用户要求重设过一次）

改密码：

```bash
# 方式一：用 OPS_PW 指定新密码重新安装
SSH_PW='<密码>' expect ./ssh-pass.exp 139.199.211.157 \
  "OPS_PW='<新密码>' bash /root/deploy-work/install-ops.sh"

# 方式二：直接在服务器上改（新口令仍由 nginx worker 用户可读）
#   printf 'admin:%s\n' "$(openssl passwd -apr1 '<新密码>')" > /etc/nginx/htpasswd
#   chown nobody /etc/nginx/htpasswd && chmod 640 /etc/nginx/htpasswd
```

新增第二个运营账号：往 `/etc/nginx/htpasswd` 追加一行 `用户名:$apr1$...` 即可。

## 目录结构

```
deploy/
├── publish.sh                 一键发布（构建 + 打包 + 上传 + 部署 + 验证）
├── ssh-pass.exp               密码登录封装（本机无 sshpass，用 expect 实现）
├── scp-pass.exp               密码上传封装
├── out/prod-server.cjs        esbuild 打包产物（自动生成）
├── nginx-aigrowpark.conf      H5 站点 Nginx 配置参考（早期版本）
├── remote/
│   ├── sites/h5.aigrowpark.com.conf   线上站点配置的唯一事实来源
│   ├── api-ecosystem.json             pm2 后端应用定义
│   ├── install-ops.sh                 安装 Nginx 配置 + 生成访问口令（首次执行）
│   ├── deploy-site.sh                 远端：同步静态文件 + reload API（每次发布，含 Nginx 自检）
│   ├── fix-nginx-temp.sh              修复「带文件上传的请求 500」（见「已知坑 10」，可重复执行）
│   └── （以下是更早的一次性初始化脚本，留档备查）
│       ├── setup-nginx.sh             备份配置 + 写入 sites + 注入 include
│       ├── migrate-and-start.sh       端口迁移 + 启动 Nginx（带自动回滚）
│       ├── build-nginx-ssl.sh         重编译 Nginx 补 SSL 模块
│       └── enable-ssl.sh              签发证书 + 启用 443
```

## 数据备份

反馈数据全在 `/www/wwwroot/h5.aigrowpark.com-api/data/`：

```bash
# 备份
tar -czf /root/deploy-backup/feedback-$(date +%Y%m%d).tar.gz \
  -C /www/wwwroot/h5.aigrowpark.com-api data

# 恢复
tar -xzf <备份文件>.tar.gz -C /www/wwwroot/h5.aigrowpark.com-api
```

## 证书续期

`acme.sh` 已装好并注册了定时任务（每天 02:49 / 08:49 / 14:49 / 20:49 检查），
到期前会自动续期并自动 reload nginx，**正常情况下不需要人工干预**。

```bash
/root/.acme.sh/acme.sh --list                              # 查看状态与下次续期时间
/root/.acme.sh/acme.sh --renew -d h5.aigrowpark.com --force --ecc   # 手动强制续期
```

## 已知坑

1. **本机构建必须用 arm64 node**
   本机 `pnpm` 跑在 Rosetta x64 的 node 下，而 `node_modules` 装的是 arm64 版 rollup，
   直接用 `pnpm build` 会报 `Cannot find module '@rollup/rollup-darwin-x64'`。
   解法见上方构建命令。

2. **多入口构建：新增页面必须加进 `vite.config.ts` 的 `input`**
   运营页的入口是 `admin.html`，需要在 `rollupOptions.input` 里显式声明，
   否则构建产物里不会生成 `admin.html`（表现为线上 `/admin` 404 而本地 dev 正常）。

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

5. **编译安装的 Nginx 默认没有 SSL 模块**
   原 `/usr/local/nginx/sbin/nginx` 的 `configure arguments` 只有 `--prefix`，
   加 `ssl_certificate` 会报 `the "ssl" parameter requires ngx_http_ssl_module`。
   已通过 `remote/build-nginx-ssl.sh` 用相同 prefix 重编译并原地替换二进制解决。

6. **basic auth 口令文件不能放在 `/usr/local/nginx/conf/`（会 500）**
   nginx master 以 root 运行，**worker 以 `nobody` 运行**，而 `/usr/local/nginx` 与
   `conf/` 都是 `drwxr-x--- root root`（750）。`nobody` 连目录都进不去，
   认证时打开口令文件失败：

   ```
   [crit] open() "/usr/local/nginx/conf/htpasswd" failed (13: Permission denied)
   ```

   症状很有迷惑性：**不带凭证返回 401 正常，带上凭证反而 500**（401 阶段还没读文件）。
   此时改文件权限是无效的（父目录不可遍历，`chmod 644` 也没用），
   要么放开父目录权限，要么**把口令文件挪到可遍历目录** —— 本项目选了后者，
   放在 `/etc/nginx/htpasswd`（该目录是 755，且是 nginx 口令文件的标准位置）。

   文件属主设为 nginx worker 用户（`nobody`）、权限 `640`，只有 worker 和 root 能读。
   `install-ops.sh` 里有一段 `runuser -u nobody -- head -c 1` 的实测校验，读不到会直接报错退出。

7. **`set -euo pipefail` 会让 `... | head -c N` 静默中断脚本**
   生成随机密码时写 `tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 16`，
   `head` 读够就退出 → `tr` 收到 SIGPIPE（退出码 141）→ `pipefail` 上报非零 → `set -e` 杀掉脚本。
   表现为**脚本跑到一半无声无息地停了**，没有任何错误信息。
   改用无管道写法：`openssl rand -base64 18 | tr -d '\n/=+'`。

8. **shell 里 `{ ...; }` 结尾必须带分号**
   `[ -n "$X" ] || { echo "err"; exit 1 }` 是**语法错误**，
   bash 报 `syntax error: unexpected end of file`（且指向文件最后一行，很难定位）。
   正确写法：`{ echo "err"; exit 1; }` —— `}` 前要有 `;` 或换行。

9. **本机 curl 会被代理干扰，且 `--resolve` 的传参有讲究**
   诊断时用 `--resolve` 强制指定 IP，但**必须写成两个独立参数**：
   ```bash
   curl -s --resolve h5.aigrowpark.com:443:139.199.211.157 --noproxy '*' ...
   ```
   注意 zsh 不会对未加引号的变量做分词，把参数放进变量会失效；
   用 zsh 数组：`R=(--resolve h5.aigrowpark.com:443:139.199.211.157 --noproxy '*')` 然后 `"${R[@]}"`。

10. **带文件上传的请求一律 500：worker 写不了 `client_body_temp`**
    与坑 6 **同源**，都是 `/usr/local/nginx` 这个前缀目录被硬化成 `750 root:root` 导致的。
    Nginx 编译时把临时目录定在 prefix 之下，它假设 prefix 可被 worker 遍历（默认 755）。

    ```
    [crit] open() "/usr/local/nginx/client_body_temp/0000000003" failed (13: Permission denied)
    ```

    注意这些临时目录**属主本来就是对的**（`drwx------ nobody root`），
    卡住的是父目录的遍历位（`o+x`），所以改临时目录权限同样无效。

    **三条症状同时出现即可确诊**：
    - 前端报 500，响应头是 `content-type: text/html` + `server: nginx/x.y.z`（nginx 生成的错误页）
    - **后端应用日志里完全没有这条请求**（请求根本没到后端，极易误判成后端 bug）
    - `error.log` 出现上面那行 `client_body_temp ... Permission denied`

    为什么平时测不出来：**请求体小于 `client_body_buffer_size`（默认 8k/16k）时走内存缓冲，不落盘**。
    所以纯文字提交一直正常，一旦带图片（哪怕只有 100KB）就 500。

    修复（`remote/fix-nginx-temp.sh`，只动一位权限，不递归、不碰子目录）：

    ```bash
    chmod o+x /usr/local/nginx
    ```

    `conf` / `logs` / `sbin` 仍是 `750 root:root`，对外不暴露任何东西。

    修复后 `error.log` 里对应的提示会从 `[crit] ... Permission denied`
    变成 `[warn] a client request body is buffered to a temporary file ...`（正常落盘）。

    `deploy-site.sh` 的「步骤 0」每次发布都会幂等自愈一次，重装 nginx 或换机器后不会复发。

## 回滚

```bash
# 站点文件回滚（保留最近 3 个版本）
ls -1dt /root/deploy-backup/site-*
tar -xzf /root/deploy-backup/site-<时间戳>/site.tar.gz -C /www/wwwroot/h5.aigrowpark.com

# Nginx 配置回滚
cp -a /root/deploy-backup/ops-<时间戳>/h5.aigrowpark.com.conf /usr/local/nginx/conf/sites/
/usr/local/nginx/sbin/nginx -t && /usr/local/nginx/sbin/nginx -s reload

# Nginx 二进制回滚（若 SSL 版本出问题）
cp -a /root/deploy-backup/nginx-binary-<时间戳>/nginx.original /usr/local/nginx/sbin/nginx
/usr/local/nginx/sbin/nginx -s stop && /usr/local/nginx/sbin/nginx

# API 后端回滚
cd /www/wwwroot/h5.aigrowpark.com-api && pm2 restart app-h5-api
```

## 服务器注意事项

**`/usr/local/nginx` 必须对 worker 用户（`nobody`）可遍历**（需要 `o+x` 位）。
Nginx 编译时把临时目录定在 prefix 之下，该目录一旦被硬化回 `750`，
带文件上传的请求就会全部 500（详见「已知坑 10」）。
检查：`ls -ld /usr/local/nginx`，正确值应为 `drwxr-x--x root root`。

原 `idea-website` 直接监听 80，为让 Nginx 接管 80/443 已迁至 **3001**（pm2 管理）。
该服务器是**多项目共用生产机**，`/code/` 下还有 8 个 pm2 应用
（`aiysmz-*`、`inventory-*`、`upload-link*` 等），改动前请先探测端口占用。
