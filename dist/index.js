"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const app_1 = require("./app");
// Start
const port = Number(process.env.PORT || 8080);
app_1.app.listen(port, () => {
    console.log(`[BOOT] Starting Genkit flow server on :${port}`);
    console.log(`[READY] Genkit flow server is listening on :${port}`);
});
//# sourceMappingURL=index.js.map