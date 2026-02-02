/**
 * MathSolver
 * Copyright (c) 2026 ICeCreamChat
 * Licensed under the MIT License.
 */
const sharp = require('sharp');

/**
 * Consistently beautifies and crops an image region
 * @param {string} imagePath 
 * @param {Array} bbox [left, top, right, bottom] (can be percentage 0-100 or pixels)
 * @returns {Promise<string|null>} base64 data url or null
 */
async function beautifyAndCrop(imagePath, initialBbox) {
    try {
        const metadata = await sharp(imagePath).metadata();
        const imgWidth = metadata.width;
        const imgHeight = metadata.height;

        let [left, top, right, bottom] = initialBbox;

        // Convert percentage to pixels if needed
        if (left <= 100 && top <= 100 && right <= 100 && bottom <= 100) {
            left = Math.round(imgWidth * left / 100);
            top = Math.round(imgHeight * top / 100);
            right = Math.round(imgWidth * right / 100);
            bottom = Math.round(imgHeight * bottom / 100);
        }

        // Calculate dimensions
        let cropWidth = right - left;
        let cropHeight = bottom - top;

        // Add 15% padding
        const paddingX = Math.round(cropWidth * 0.15);
        const paddingY = Math.round(cropHeight * 0.15);

        left = Math.max(0, left - paddingX);
        top = Math.max(0, top - paddingY);
        right = Math.min(imgWidth, right + paddingX);
        bottom = Math.min(imgHeight, bottom + paddingY);

        cropWidth = right - left;
        cropHeight = bottom - top;

        if (cropWidth < 50 || cropHeight < 50) return null;

        console.log(`[Beautify] 裁剪区域: ${cropWidth}x${cropHeight}`);

        // Extract raw pixel data
        const { data, info } = await sharp(imagePath)
            .extract({ left, top, width: cropWidth, height: cropHeight })
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Detect background color (sampling corners + center edges)
        const channels = info.channels;
        const getPixel = (x, y) => {
            const idx = (y * cropWidth + x) * channels;
            return [data[idx], data[idx + 1], data[idx + 2]];
        };

        const samples = [
            getPixel(2, 2),
            getPixel(cropWidth - 3, 2),
            getPixel(2, cropHeight - 3),
            getPixel(cropWidth - 3, cropHeight - 3),
            getPixel(Math.floor(cropWidth / 2), 2),
            getPixel(2, Math.floor(cropHeight / 2)),
        ];

        const bgR = Math.round(samples.reduce((s, c) => s + c[0], 0) / samples.length);
        const bgG = Math.round(samples.reduce((s, c) => s + c[1], 0) / samples.length);
        const bgB = Math.round(samples.reduce((s, c) => s + c[2], 0) / samples.length);

        console.log(`[Beautify] 检测到背景色: rgb(${bgR}, ${bgG}, ${bgB})`);

        // Process pixels: Whiten background + Darken lines
        const newData = Buffer.alloc(data.length);
        const threshold = 80;

        for (let i = 0; i < data.length; i += channels) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);

            if (diff < threshold) {
                // Background -> White
                newData[i] = 255;
                newData[i + 1] = 255;
                newData[i + 2] = 255;
            } else {
                // Lines -> Darken
                const darken = 0.4;
                newData[i] = Math.round(Math.min(255, Math.max(0, r * darken)));
                newData[i + 1] = Math.round(Math.min(255, Math.max(0, g * darken)));
                newData[i + 2] = Math.round(Math.min(255, Math.max(0, b * darken)));
            }

            // Copy alpha
            if (channels === 4) {
                newData[i + 3] = data[i + 3];
            }
        }

        // Output buffer
        const resultBuffer = await sharp(newData, {
            raw: { width: cropWidth, height: cropHeight, channels }
        })
            .png()
            .toBuffer();

        console.log('[Beautify] 美化完成');
        return `data:image/png;base64,${resultBuffer.toString('base64')}`;
    } catch (e) {
        console.error('[Beautify Error]', e.message);
        return null;
    }
}

module.exports = { beautifyAndCrop };
