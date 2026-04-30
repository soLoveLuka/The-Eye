# Deploy The Eye to iamlive.one

## 1) What I need from you (one thing)
Your server **public IPv4 address** (the machine that will run Node + Nginx).

---

## 2) Porkbun DNS (you do this)
Go to: **Porkbun → Domain Management → iamlive.one → DNS**

Create/Update records:

- Type: `A`
  - Host: `@`
  - Answer: `<YOUR_SERVER_IPV4>`
  - TTL: `600`

- Type: `A`
  - Host: `www`
  - Answer: `<YOUR_SERVER_IPV4>`
  - TTL: `600`

Remove conflicting old `A/AAAA/CNAME` records for `@` and `www`.

---

## 3) Server setup (I can run once you give access)

```bash
# Ubuntu/Debian baseline
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx git

# Node 22 + pm2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

---

## 4) Deploy app

```bash
sudo mkdir -p /var/www/the-eye
sudo chown -R $USER:$USER /var/www/the-eye
cd /var/www/the-eye

# Clone your repo
git clone https://github.com/soLoveLuka/The-Eye.git .
npm install --omit=dev
```

Set secret:

```bash
cp .env.example .env
# edit AUTH_SECRET to a long random value
nano .env
```

Start with PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 5) Nginx reverse proxy

```bash
sudo cp deploy/nginx.iamlive.one.conf /etc/nginx/sites-available/iamlive.one
sudo ln -sf /etc/nginx/sites-available/iamlive.one /etc/nginx/sites-enabled/iamlive.one
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6) HTTPS certificate

```bash
sudo certbot --nginx -d iamlive.one -d www.iamlive.one
```

Choose redirect to HTTPS when prompted.

---

## 7) Smoke tests

```bash
curl -s https://iamlive.one/api/health
# should return: {"ok":true,...}
```

Then test signup/login in browser at:
- https://iamlive.one

---

## 8) GitHub Pages note
If you currently point users to a GitHub Pages domain, stop using it for this app.
Auth + websocket app should run from the same origin:
- `https://iamlive.one`

