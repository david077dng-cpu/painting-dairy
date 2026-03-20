const path = require('path');
console.log('__dirname:', __dirname);
console.log('../../../.. =>', path.resolve(__dirname, '../../../..'));
console.log('../../../../ =>', path.resolve(__dirname, '../../../../'));
console.log('____________________________________');
console.log('From:', __dirname);
console.log('To POSTS:', path.resolve(__dirname, '../../../..', 'src/content/posts'));
console.log('To download-images.js:', path.resolve(__dirname, '../../../..', 'download-images.js'));
