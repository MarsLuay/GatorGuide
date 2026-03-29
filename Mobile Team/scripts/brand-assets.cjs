#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { generateImageAsync, getPngInfo } = require('@expo/image-utils');

const projectRoot = path.resolve(__dirname, '..');
const appConfigPath = path.join(projectRoot, 'app.json');
const checkOnly = process.argv.includes('--check');

const generatedAssetSpecs = [
  {
    label: 'App icon',
    source: 'assets/images/icon.png',
    output: 'assets/images/icon.png',
    width: 1024,
    height: 1024,
    resizeMode: 'cover',
    backgroundColor: '#FFFFFF',
    removeTransparency: true,
  },
  {
    label: 'Compatibility icon',
    source: 'assets/images/icon.png',
    output: 'assets/icon.png',
    width: 1024,
    height: 1024,
    resizeMode: 'cover',
    backgroundColor: '#FFFFFF',
    removeTransparency: true,
  },
  {
    label: 'Android adaptive foreground',
    source: 'assets/images/android-icon-foreground.png',
    output: 'assets/images/android-icon-foreground.png',
    width: 1024,
    height: 1024,
    resizeMode: 'contain',
    backgroundColor: 'transparent',
  },
  {
    label: 'Android adaptive background',
    source: 'assets/images/android-icon-background.png',
    output: 'assets/images/android-icon-background.png',
    width: 1024,
    height: 1024,
    resizeMode: 'cover',
    backgroundColor: '#E6F4FE',
    removeTransparency: true,
  },
  {
    label: 'Android adaptive monochrome',
    source: 'assets/images/android-icon-monochrome.png',
    output: 'assets/images/android-icon-monochrome.png',
    width: 1024,
    height: 1024,
    resizeMode: 'contain',
    backgroundColor: 'transparent',
  },
  {
    label: 'Web favicon source',
    source: 'assets/images/icon.png',
    output: 'assets/images/favicon.png',
    width: 512,
    height: 512,
    resizeMode: 'cover',
    backgroundColor: '#FFFFFF',
    removeTransparency: true,
  },
  {
    label: 'Splash mark',
    source: 'assets/images/android-icon-foreground.png',
    output: 'assets/images/splash-icon.png',
    width: 1024,
    height: 1024,
    resizeMode: 'contain',
    backgroundColor: 'transparent',
  },
];

const placeholderAssets = [
  'assets/images/partial-react-logo.png',
  'assets/images/react-logo.png',
  'assets/images/react-logo@2x.png',
  'assets/images/react-logo@3x.png',
];

const expectedConfig = {
  name: 'Gator Guide',
  icon: './assets/images/icon.png',
  webFavicon: './assets/images/favicon.png',
  splashImage: './assets/images/splash-icon.png',
  androidForeground: './assets/images/android-icon-foreground.png',
  androidBackground: './assets/images/android-icon-background.png',
  androidMonochrome: './assets/images/android-icon-monochrome.png',
};

function toProjectPath(relativePath) {
  return path.join(projectRoot, relativePath);
}

async function readAppConfigAsync() {
  const raw = await fs.readFile(appConfigPath, 'utf8');
  return JSON.parse(raw);
}

async function generateAssetsAsync() {
  for (const spec of generatedAssetSpecs) {
    const source = toProjectPath(spec.source);
    const output = toProjectPath(spec.output);
    const { source: buffer } = await generateImageAsync(
      { projectRoot },
      {
        src: source,
        width: spec.width,
        height: spec.height,
        resizeMode: spec.resizeMode,
        backgroundColor: spec.backgroundColor,
        removeTransparency: spec.removeTransparency,
        name: path.basename(output),
      }
    );

    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, buffer);
    const png = await getPngInfo(output);

    if (png.width !== spec.width || png.height !== spec.height) {
      throw new Error(
        `${spec.label} generated at ${png.width}x${png.height}; expected ${spec.width}x${spec.height}.`
      );
    }

    console.log(`Generated ${spec.label}: ${spec.output} (${png.width}x${png.height})`);
  }
}

async function verifyConfigAsync() {
  const config = await readAppConfigAsync();
  const expoConfig = config.expo ?? {};
  const errors = [];

  if (expoConfig.name !== expectedConfig.name) {
    errors.push(`expo.name should be "${expectedConfig.name}" but is "${expoConfig.name ?? 'undefined'}".`);
  }
  if (expoConfig.icon !== expectedConfig.icon) {
    errors.push(`expo.icon should be "${expectedConfig.icon}" but is "${expoConfig.icon ?? 'undefined'}".`);
  }
  if (expoConfig.web?.favicon !== expectedConfig.webFavicon) {
    errors.push(
      `expo.web.favicon should be "${expectedConfig.webFavicon}" but is "${expoConfig.web?.favicon ?? 'undefined'}".`
    );
  }

  const androidAdaptiveIcon = expoConfig.android?.adaptiveIcon ?? {};
  if (androidAdaptiveIcon.foregroundImage !== expectedConfig.androidForeground) {
    errors.push(
      `expo.android.adaptiveIcon.foregroundImage should be "${expectedConfig.androidForeground}" but is "${androidAdaptiveIcon.foregroundImage ?? 'undefined'}".`
    );
  }
  if (androidAdaptiveIcon.backgroundImage !== expectedConfig.androidBackground) {
    errors.push(
      `expo.android.adaptiveIcon.backgroundImage should be "${expectedConfig.androidBackground}" but is "${androidAdaptiveIcon.backgroundImage ?? 'undefined'}".`
    );
  }
  if (androidAdaptiveIcon.monochromeImage !== expectedConfig.androidMonochrome) {
    errors.push(
      `expo.android.adaptiveIcon.monochromeImage should be "${expectedConfig.androidMonochrome}" but is "${androidAdaptiveIcon.monochromeImage ?? 'undefined'}".`
    );
  }

  const splashPlugin = (expoConfig.plugins ?? []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
  );
  if (!splashPlugin || !Array.isArray(splashPlugin)) {
    errors.push('expo-splash-screen plugin configuration is missing.');
  } else {
    const splashConfig = splashPlugin[1] ?? {};
    if (splashConfig.image !== expectedConfig.splashImage) {
      errors.push(
        `expo-splash-screen image should be "${expectedConfig.splashImage}" but is "${splashConfig.image ?? 'undefined'}".`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

async function verifyAssetsAsync() {
  for (const spec of generatedAssetSpecs) {
    const output = toProjectPath(spec.output);
    let png;
    try {
      png = await getPngInfo(output);
    } catch (error) {
      throw new Error(`Missing ${spec.label} at ${spec.output}. ${error.message}`);
    }

    if (png.width !== spec.width || png.height !== spec.height) {
      throw new Error(
        `${spec.label} at ${spec.output} is ${png.width}x${png.height}; expected ${spec.width}x${spec.height}.`
      );
    }
  }
}

async function verifyPlaceholderCleanupAsync() {
  const lingering = [];
  for (const relativePath of placeholderAssets) {
    try {
      await fs.access(toProjectPath(relativePath));
      lingering.push(relativePath);
    } catch {
      // Expected: placeholder file is gone.
    }
  }

  if (lingering.length > 0) {
    throw new Error(`Placeholder brand assets still exist:\n${lingering.join('\n')}`);
  }
}

async function main() {
  if (!checkOnly) {
    await generateAssetsAsync();
  }

  await verifyAssetsAsync();
  await verifyConfigAsync();
  await verifyPlaceholderCleanupAsync();

  const mode = checkOnly ? 'Verified' : 'Generated and verified';
  console.log(`${mode} Gator Guide brand assets.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
