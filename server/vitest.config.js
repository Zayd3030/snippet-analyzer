import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // set before any module loads, so database.js opens an in-memory db instead of the real file
    env: {
      DB_PATH: ':memory:',
      ANALYZER: 'rules',
    },
  },
})
