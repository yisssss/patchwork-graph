import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isIOS = mode === 'ios';
  
  return {
    base: '/patchwork-graph/',  // GitHub repo 이름과 동일하게
  
    // iOS Safari 호환성을 위한 설정
    build: {
      target: isIOS ? ['es2015', 'safari11'] : ['es2015', 'chrome60'], // iOS 모드에서는 Safari 11+ 지원
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isIOS, // iOS에서는 console 제거
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'three': ['three'],
            'gsap': ['gsap'],
          },
        },
      },
      // iOS에서 메모리 문제 방지
      chunkSizeWarningLimit: isIOS ? 800 : 1000,
    },
  
  // 개발 서버 설정
  server: {
    host: true,
    port: 3000,
  },
  
  // iOS Safari를 위한 polyfill 설정
  define: {
    global: 'globalThis',
  },
  
    // CSS 최적화
    css: {
      postcss: {
        plugins: [
          // iOS Safari를 위한 autoprefixer
          require('autoprefixer')({
            overrideBrowserslist: isIOS ? [
              'iOS >= 11',
              'Safari >= 11',
            ] : [
              'iOS >= 11',
              'Safari >= 11',
              'Chrome >= 60',
              'Firefox >= 60',
            ],
          }),
        ],
      },
    },
  };
});
