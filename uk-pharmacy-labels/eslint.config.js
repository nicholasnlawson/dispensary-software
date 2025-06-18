export default [
  {
    "env": {
      "browser": true,
      "es6": true,
      "node": true
    },
    "globals": {
      "Atomics": "readonly",
      "SharedArrayBuffer": "readonly",
      "OrderManager": "readonly",
      "MedicationManager": "readonly",
      "showToastNotification": "readonly",
      "createToastContainer": "readonly",
      "closeOrderDetailModal": "readonly",
      "currentOrder": "writable"
    },
    "parserOptions": {
      "ecmaVersion": 2022,
      "sourceType": "module"
    },
    "rules": {
      "no-unused-vars": "warn",
      "no-undef": "warn"
    }
  }
];
