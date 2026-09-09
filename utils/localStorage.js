import crypto from "crypto";
import path from "path";
import {
    access,
    mkdir,
    readFile,
    rename,
    stat,
    unlink,
    writeFile,
} from "fs/promises";
import { constants as fsConstants, createReadStream } from "fs";
import HttpError from "./httpError.js";

const DEFAULT_RESOURCES_DIRECTORY = "blackboardai-pdfs-resources";
const DEFAULT_PROFILE_IMAGES_DIRECTORY = "blackboardai-profile-images";

export const localStorageRoot = path.resolve(
    process.env.LOCAL_STORAGE_ROOT || path.join(process.cwd(), "storage", "gcs")
);

export const resourcesDirectory = path.join(
    localStorageRoot,
    DEFAULT_RESOURCES_DIRECTORY
);

export const profileImagesDirectory = path.join(
    localStorageRoot,
    DEFAULT_PROFILE_IMAGES_DIRECTORY
);

const resolveWithin = (root, storageKey) => {
    const key = String(storageKey || "").replaceAll("\\", "/");
    if (!key || key.includes("\0") || path.posix.isAbsolute(key)) {
        throw new HttpError(400, "Invalid storage key.");
    }

    const resolvedRoot = path.resolve(root);
    const resolvedPath = path.resolve(resolvedRoot, key);
    if (
        resolvedPath !== resolvedRoot &&
        !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)
    ) {
        throw new HttpError(400, "Invalid storage key.");
    }
    return resolvedPath;
};

const fileInfo = async (root, storageKey) => {
    const filePath = resolveWithin(root, storageKey);
    try {
        await access(filePath, fsConstants.R_OK);
        const metadata = await stat(filePath);
        if (!metadata.isFile()) {
            throw new HttpError(404, "File not found.");
        }
        return { filePath, metadata };
    } catch (error) {
        if (error instanceof HttpError) throw error;
        if (["ENOENT", "EACCES"].includes(error?.code)) {
            throw new HttpError(404, "File not found.");
        }
        throw error;
    }
};

const writeAtomic = async (root, storageKey, data) => {
    const filePath = resolveWithin(root, storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
        await writeFile(temporaryPath, data, { flag: "wx" });
        await rename(temporaryPath, filePath);
    } catch (error) {
        try {
            await unlink(temporaryPath);
        } catch {
            // Nothing to clean up if the temporary file was never created.
        }
        throw error;
    }
    return filePath;
};

export const sanitizeStorageFilename = (filename, fallback = "file") => {
    const basename = path.basename(String(filename || fallback));
    const safe = basename
        .normalize("NFKC")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^\.+/, "")
        .slice(0, 180);
    return safe || fallback;
};

export const ensureStorageDirectories = async () => {
    await Promise.all([
        mkdir(resourcesDirectory, { recursive: true }),
        mkdir(profileImagesDirectory, { recursive: true }),
    ]);
};

export const getResourceFile = (storageKey) => (
    fileInfo(resourcesDirectory, storageKey)
);

export const readResourceFile = async (storageKey) => {
    const { filePath } = await getResourceFile(storageKey);
    return readFile(filePath);
};

export const createResourceReadStream = (filePath, options = undefined) => (
    createReadStream(filePath, options)
);

export const writeResourceFile = (storageKey, data) => (
    writeAtomic(resourcesDirectory, storageKey, data)
);

export const writeProfileImage = (storageKey, data) => (
    writeAtomic(profileImagesDirectory, storageKey, data)
);

export const profileImageUrl = (storageKey) => {
    const encodedPath = String(storageKey)
        .split("/")
        .map(encodeURIComponent)
        .join("/");
    const mediaPath = `/media/profile-images/${encodedPath}`;
    const baseUrl = String(process.env.PUBLIC_BASE_URL || "")
        .trim()
        .replace(/\/+$/, "");
    return baseUrl ? `${baseUrl}${mediaPath}` : mediaPath;
};

