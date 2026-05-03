import adapter from '@sveltejs/adapter-static';

const rawBase = process.env.BASE_PATH ?? '';
const normalizedBase = rawBase.trim();
const base =
  !normalizedBase || normalizedBase === '/'
    ? ''
    : normalizedBase.replace(/\/+$/, '');

const config = {
  kit: {
    adapter: adapter({
      pages: 'dist',
      assets: 'dist'
    }),
    paths: {
      base
    }
  }
};

export default config;
