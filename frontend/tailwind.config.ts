import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#121212',
        mist: '#f6f3ed',
        ember: '#f25f3a',
        tide: '#117a8b',
        slate: '#2f4550',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(17, 122, 139, 0.16)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Source Sans 3"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      backgroundImage: {
        'mesh-soft':
          'radial-gradient(circle at 25% 20%, rgba(242, 95, 58, 0.22), transparent 35%), radial-gradient(circle at 75% 10%, rgba(17, 122, 139, 0.24), transparent 42%), radial-gradient(circle at 50% 80%, rgba(47, 69, 80, 0.18), transparent 40%)',
      },
    },
  },
  plugins: [],
};

export default config;
