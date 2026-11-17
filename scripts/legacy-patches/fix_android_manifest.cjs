const fs = require('fs');
const file = 'android/app/src/main/AndroidManifest.xml';
let content = fs.readFileSync(file, 'utf8');

const permissions = `
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
`;

if (!content.includes('READ_MEDIA_IMAGES')) {
  content = content.replace('<uses-permission android:name="android.permission.CAMERA" />', '<uses-permission android:name="android.permission.CAMERA" />\n' + permissions);
  fs.writeFileSync(file, content);
  console.log('✅ Fixed AndroidManifest.xml (Added Media Permissions)');
} else {
  console.log('✅ Permissions already exist.');
}
