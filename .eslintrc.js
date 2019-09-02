module.exports = {
    env: {
        commonjs: true,
        es6: true,
    },
    extends: ["standard", "prettier", "prettier/standard"],
    globals: {
        Atomics: "readonly",
        SharedArrayBuffer: "readonly"
    },
    parserOptions: {
        ecmaVersion: 2018
    },
    plugins: ["prettier", "ava"],
    rules: {
        indent: [1, 4],
        curly: ["error", "all"],
        "prettier/prettier": "error",
        "linebreak-style": ["error", "windows"],
        "new-cap": ["error", { "newIsCapExceptionPattern": "^winston\.." }]
    }
};
