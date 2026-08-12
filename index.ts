import express from 'express';
import server from './server/src/index.js';

// Vercel 的 Express 框架检测要求根入口直接导入 express。
void express;

export default server;
