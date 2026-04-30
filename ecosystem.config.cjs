module.exports = {
  apps: [
    {
      name: "the-eye",
      script: "server.js",
      cwd: "/var/www/the-eye",
      env: {
        NODE_ENV: "production",
        PORT: 8787,
        AUTH_SECRET: "CHANGE_ME_LONG_RANDOM_SECRET",
        MASTER_ACCESS_CODE: "CHANGE_ME_MASTER_INVITE_CODE"
      }
    }
  ]
};
