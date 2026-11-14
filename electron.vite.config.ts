import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import license from 'rollup-plugin-license';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': path.resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        plugins: [
          license({
            thirdParty: {
              includePrivate: false,
              output: {
                file: path.resolve('out/oss-licenses.json'),
                template(dependencies) {
                  return JSON.stringify(
                    dependencies.map((dep) => ({
                      name: dep.name ?? 'unknown',
                      version: dep.version ?? '',
                      license: dep.license ?? 'UNKNOWN',
                      author:
                        typeof dep.author === 'string'
                          ? dep.author
                          : (dep.author?.name ?? ''),
                      repository:
                        typeof dep.repository === 'string'
                          ? dep.repository
                          : (dep.repository?.url ?? ''),
                      licenseText: dep.licenseText ?? ''
                    })),
                    null,
                    2
                  );
                }
              }
            }
          })
        ]
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': path.resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': path.resolve('src/renderer/src'),
        '@shared': path.resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
});
