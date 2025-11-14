// deploy.js
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting deployment to GitHub Pages...');

try {
    // Сборка проекта
    console.log('📦 Building project...');
    execSync('npm run build', { stdio: 'inherit' });

    // Создание .nojekyll файла для игнорирования Jekyll processing
    fs.writeFileSync(path.join('dist', '.nojekyll'), '');

    // Деплой на GitHub Pages
    console.log('📤 Deploying to GitHub Pages...');
    execSync('npx gh-pages -d dist', { stdio: 'inherit' });

    console.log('✅ Successfully deployed to GitHub Pages!');
    console.log('🌐 Your site is available at: https://vasilkin6666.github.io/max_project_pilot');
} catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
}
