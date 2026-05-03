import adapter from '@sveltejs/adapter-static';

const base = process.env.BASE_PATH ?? '';

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
