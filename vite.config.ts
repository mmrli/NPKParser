import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true
    })
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: '@rain-monorepo/npk-parser',
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: [],
      output: {}
    },
    outDir: 'dist',
    sourcemap: true
  }
})
