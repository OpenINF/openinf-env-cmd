import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveEnvFilePath, IMPORT_HOOK_EXTENSIONS, isPromise, importAttributesKeyword } from './utils.js';
/**
 * Gets the environment vars from an env file
 */
export async function getEnvFileVars(envFilePath) {
    const absolutePath = resolveEnvFilePath(envFilePath);
    if (!existsSync(absolutePath)) {
        const pathError = new Error(`Invalid env file path (${envFilePath}).`);
        pathError.name = 'PathError';
        throw pathError;
    }
    // Get the file extension
    const ext = extname(absolutePath).toLowerCase();
    let env = {};
    if (IMPORT_HOOK_EXTENSIONS.includes(ext)) {
        // For some reason in ES Modules, only JSON file types need to be specifically delinated when importing them
        let attributeTypes = {};
        if (ext === '.json') {
            attributeTypes = { [importAttributesKeyword]: { type: 'json' } };
        }
        const res = await import(pathToFileURL(absolutePath).href, attributeTypes);
        if ('default' in res) {
            env = res.default;
        }
        else {
            env = res;
        }
        // Check to see if the imported value is a promise
        if (isPromise(env)) {
            env = await env;
        }
    }
    else {
        const file = readFileSync(absolutePath, { encoding: 'utf8' });
        env = parseEnvString(file);
    }
    return env;
}
/**
 * Parse out all env vars from a given env file string and return an object
 */
export function parseEnvString(envFileString) {
    // First thing we do is stripe out all comments
    envFileString = stripComments(envFileString.toString());
    // Next we stripe out all the empty lines
    envFileString = stripEmptyLines(envFileString);
    // Merge the file env vars with the current process env vars (the file vars overwrite process vars)
    return parseEnvVars(envFileString);
}
/**
 * Parse out all env vars from an env file string
 */
export function parseEnvVars(envString) {
    const envParseRegex = /^((.+?)[=](.*))$/gim;
    const matches = {};
    let match;
    while ((match = envParseRegex.exec(envString)) !== null) {
        // Note: match[1] is the full env=var line
        const key = match[2].trim();
        let value = match[3].trim();
        // remove any surrounding quotes
        value = value
            .replace(/(^['"]|['"]$)/g, '')
            .replace(/\\n/g, '\n');
        // Convert string to JS type if appropriate
        if (value !== '' && !isNaN(+value)) {
            matches[key] = +value;
        }
        else if (value === 'true') {
            matches[key] = true;
        }
        else if (value === 'false') {
            matches[key] = false;
        }
        else {
            matches[key] = value;
        }
    }
    return JSON.parse(JSON.stringify(matches));
}
/**
 * Strips out comments from env file string
 */
export function stripComments(envString) {
    const commentsRegex = /(^\s*#.*$)/gim;
    return envString.replace(commentsRegex, '');
}
/**
 * Strips out newlines from env file string
 */
export function stripEmptyLines(envString) {
    const emptyLinesRegex = /(^\n)/gim;
    return envString.replace(emptyLinesRegex, '');
}
