var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { LineType } from './types';
import { escapeForRegExp } from './utils';
function getExtension(filename, language) {
    var filenameParts = filename.split('.');
    return filenameParts.length > 1 ? filenameParts[filenameParts.length - 1] : language;
}
function startsWithAny(str, prefixes) {
    return prefixes.reduce(function (startsWith, prefix) { return startsWith || str.startsWith(prefix); }, false);
}
var baseDiffFilenamePrefixes = ['a/', 'b/', 'i/', 'w/', 'c/', 'o/'];
function getFilename(line, linePrefix, extraPrefix) {
    var prefixes = extraPrefix !== undefined ? __spreadArray(__spreadArray([], baseDiffFilenamePrefixes, true), [extraPrefix], false) : baseDiffFilenamePrefixes;
    var FilenameRegExp = linePrefix
        ? new RegExp("^".concat(escapeForRegExp(linePrefix), " \"?(.+?)\"?(\\t\\([^)]+\\))?$"))
        : new RegExp('^"?(.+?)"?(\\t\\([^)]+\\))?$');
    var _a = FilenameRegExp.exec(line) || [], _b = _a[1], filename = _b === void 0 ? '' : _b;
    var matchingPrefix = prefixes.find(function (p) { return filename.indexOf(p) === 0; });
    var fnameWithoutPrefix = matchingPrefix ? filename.slice(matchingPrefix.length) : filename;
    return fnameWithoutPrefix.replace(/\s+\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)? [+-]\d{4}.*$/, '');
}
function getSrcFilename(line, srcPrefix) {
    return getFilename(line, '---', srcPrefix);
}
function getDstFilename(line, dstPrefix) {
    return getFilename(line, '+++', dstPrefix);
}
export function parse(diffInput, config) {
    if (config === void 0) { config = {}; }
    var files = [];
    var currentFile = null;
    var currentBlock = null;
    var oldLine = null;
    var oldLine2 = null;
    var newLine = null;
    var possibleOldName = null;
    var possibleNewName = null;
    var oldFileNameHeader = '--- ';
    var newFileNameHeader = '+++ ';
    var hunkHeaderPrefix = '@@';
    var oldMode = /^old mode (\d{6})/;
    var newMode = /^new mode (\d{6})/;
    var deletedFileMode = /^deleted file mode (\d{6})/;
    var newFileMode = /^new file mode (\d{6})/;
    var copyFrom = /^copy from "?(.+)"?/;
    var copyTo = /^copy to "?(.+)"?/;
    var renameFrom = /^rename from "?(.+)"?/;
    var renameTo = /^rename to "?(.+)"?/;
    var similarityIndex = /^similarity index (\d+)%/;
    var dissimilarityIndex = /^dissimilarity index (\d+)%/;
    var index = /^index ([\da-z]+)\.\.([\da-z]+)\s*(\d{6})?/;
    var binaryFiles = /^Binary files (.*) and (.*) differ/;
    var binaryDiff = /^GIT binary patch/;
    var combinedIndex = /^index ([\da-z]+),([\da-z]+)\.\.([\da-z]+)/;
    var combinedMode = /^mode (\d{6}),(\d{6})\.\.(\d{6})/;
    var combinedNewFile = /^new file mode (\d{6})/;
    var combinedDeletedFile = /^deleted file mode (\d{6}),(\d{6})/;
    var diffLines = diffInput
        .replace(/\\ No newline at end of file/g, '')
        .replace(/\r\n?/g, '\n')
        .split('\n');
    function saveBlock() {
        if (currentBlock !== null && currentFile !== null) {
            currentFile.blocks.push(currentBlock);
            currentBlock = null;
        }
    }
    function saveFile() {
        if (currentFile !== null) {
            if (!currentFile.oldName && possibleOldName !== null) {
                currentFile.oldName = possibleOldName;
            }
            if (!currentFile.newName && possibleNewName !== null) {
                currentFile.newName = possibleNewName;
            }
            if (currentFile.newName) {
                files.push(currentFile);
                currentFile = null;
            }
        }
        possibleOldName = null;
        possibleNewName = null;
    }
    function startFile() {
        saveBlock();
        saveFile();
        currentFile = {
            blocks: [],
            deletedLines: 0,
            addedLines: 0,
        };
    }
    function startBlock(line) {
        saveBlock();
        var values;
        if (currentFile !== null) {
            if ((values = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@.*/.exec(line))) {
                currentFile.isCombined = false;
                oldLine = parseInt(values[1], 10);
                newLine = parseInt(values[2], 10);
            }
            else if ((values = /^@@@ -(\d+)(?:,\d+)? -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@@.*/.exec(line))) {
                currentFile.isCombined = true;
                oldLine = parseInt(values[1], 10);
                oldLine2 = parseInt(values[2], 10);
                newLine = parseInt(values[3], 10);
            }
            else {
                if (line.startsWith(hunkHeaderPrefix)) {
                    console.error('Failed to parse lines, starting in 0!');
                }
                oldLine = 0;
                newLine = 0;
                currentFile.isCombined = false;
            }
        }
        currentBlock = {
            lines: [],
            oldStartLine: oldLine,
            oldStartLine2: oldLine2,
            newStartLine: newLine,
            header: line,
        };
    }
    function createLine(line) {
        if (currentFile === null || currentBlock === null || oldLine === null || newLine === null)
            return;
        var currentLine = {
            content: line,
        };
        var addedPrefixes = currentFile.isCombined ? ['+ ', ' +', '++'] : ['+'];
        var deletedPrefixes = currentFile.isCombined ? ['- ', ' -', '--'] : ['-'];
        if (startsWithAny(line, addedPrefixes)) {
            currentFile.addedLines++;
            currentLine.type = LineType.INSERT;
            currentLine.oldNumber = undefined;
            currentLine.newNumber = newLine++;
        }
        else if (startsWithAny(line, deletedPrefixes)) {
            currentFile.deletedLines++;
            currentLine.type = LineType.DELETE;
            currentLine.oldNumber = oldLine++;
            currentLine.newNumber = undefined;
        }
        else {
            currentLine.type = LineType.CONTEXT;
            currentLine.oldNumber = oldLine++;
            currentLine.newNumber = newLine++;
        }
        currentBlock.lines.push(currentLine);
    }
    function existHunkHeader(line, lineIdx) {
        var idx = lineIdx;
        while (idx < diffLines.length - 3) {
            if (line.startsWith('diff')) {
                return false;
            }
            if (diffLines[idx].startsWith(oldFileNameHeader) &&
                diffLines[idx + 1].startsWith(newFileNameHeader) &&
                diffLines[idx + 2].startsWith(hunkHeaderPrefix)) {
                return true;
            }
            idx++;
        }
        return false;
    }
    diffLines.forEach(function (line, lineIndex) {
        if (!line || line.startsWith('*')) {
            return;
        }
        var values;
        var prevLine = diffLines[lineIndex - 1];
        var nxtLine = diffLines[lineIndex + 1];
        var afterNxtLine = diffLines[lineIndex + 2];
        if (line.startsWith('diff --git') || line.startsWith('diff --combined')) {
            startFile();
            var gitDiffStart = /^diff --git "?([a-ciow]\/.+)"? "?([a-ciow]\/.+)"?/;
            if ((values = gitDiffStart.exec(line))) {
                possibleOldName = getFilename(values[1], undefined, config.dstPrefix);
                possibleNewName = getFilename(values[2], undefined, config.srcPrefix);
            }
            if (currentFile === null) {
                throw new Error('Where is my file !!!');
            }
            currentFile.isGitDiff = true;
            return;
        }
        if (line.startsWith('Binary files') && !(currentFile === null || currentFile === void 0 ? void 0 : currentFile.isGitDiff)) {
            startFile();
            var unixDiffBinaryStart = /^Binary files "?([a-ciow]\/.+)"? and "?([a-ciow]\/.+)"? differ/;
            if ((values = unixDiffBinaryStart.exec(line))) {
                possibleOldName = getFilename(values[1], undefined, config.dstPrefix);
                possibleNewName = getFilename(values[2], undefined, config.srcPrefix);
            }
            else {
                var subversionDiffBinaryStart = /^Binary files (.*?)\s*and (.*?)\s*differ/;
                if ((values = subversionDiffBinaryStart.exec(line))) {
                    possibleOldName = getFilename(values[1], undefined, config.dstPrefix);
                    possibleNewName = getFilename(values[2], undefined, config.srcPrefix);
                }
            }
            if (currentFile === null) {
                throw new Error('Where is my file !!!');
            }
            currentFile.isBinary = true;
            return;
        }
        if (!currentFile ||
            (!currentFile.isGitDiff &&
                currentFile &&
                line.startsWith(oldFileNameHeader) &&
                nxtLine.startsWith(newFileNameHeader) &&
                afterNxtLine.startsWith(hunkHeaderPrefix))) {
            startFile();
        }
        if (currentFile === null || currentFile === void 0 ? void 0 : currentFile.isTooBig) {
            return;
        }
        if (currentFile &&
            ((typeof config.diffMaxChanges === 'number' &&
                currentFile.addedLines + currentFile.deletedLines > config.diffMaxChanges) ||
                (typeof config.diffMaxLineLength === 'number' && line.length > config.diffMaxLineLength))) {
            currentFile.isTooBig = true;
            currentFile.addedLines = 0;
            currentFile.deletedLines = 0;
            currentFile.blocks = [];
            currentBlock = null;
            var message = typeof config.diffTooBigMessage === 'function'
                ? config.diffTooBigMessage(files.length)
                : 'Diff too big to be displayed';
            startBlock(message);
            return;
        }
        if ((line.startsWith(oldFileNameHeader) && nxtLine.startsWith(newFileNameHeader)) ||
            (line.startsWith(newFileNameHeader) && prevLine.startsWith(oldFileNameHeader))) {
            if (currentFile &&
                !currentFile.oldName &&
                line.startsWith('--- ') &&
                (values = getSrcFilename(line, config.srcPrefix))) {
                currentFile.oldName = values;
                currentFile.language = getExtension(currentFile.oldName, currentFile.language);
                return;
            }
            if (currentFile &&
                !currentFile.newName &&
                line.startsWith('+++ ') &&
                (values = getDstFilename(line, config.dstPrefix))) {
                currentFile.newName = values;
                currentFile.language = getExtension(currentFile.newName, currentFile.language);
                return;
            }
        }
        if (currentFile &&
            (line.startsWith(hunkHeaderPrefix) ||
                (currentFile.isGitDiff && currentFile.oldName && currentFile.newName && !currentBlock))) {
            startBlock(line);
            return;
        }
        if (currentBlock && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
            createLine(line);
            return;
        }
        var doesNotExistHunkHeader = !existHunkHeader(line, lineIndex);
        if (currentFile === null) {
            throw new Error('Where is my file !!!');
        }
        if ((values = oldMode.exec(line))) {
            currentFile.oldMode = values[1];
        }
        else if ((values = newMode.exec(line))) {
            currentFile.newMode = values[1];
        }
        else if ((values = deletedFileMode.exec(line))) {
            currentFile.deletedFileMode = values[1];
            currentFile.isDeleted = true;
        }
        else if ((values = newFileMode.exec(line))) {
            currentFile.newFileMode = values[1];
            currentFile.isNew = true;
        }
        else if ((values = copyFrom.exec(line))) {
            if (doesNotExistHunkHeader) {
                currentFile.oldName = values[1];
            }
            currentFile.isCopy = true;
        }
        else if ((values = copyTo.exec(line))) {
            if (doesNotExistHunkHeader) {
                currentFile.newName = values[1];
            }
            currentFile.isCopy = true;
        }
        else if ((values = renameFrom.exec(line))) {
            if (doesNotExistHunkHeader) {
                currentFile.oldName = values[1];
            }
            currentFile.isRename = true;
        }
        else if ((values = renameTo.exec(line))) {
            if (doesNotExistHunkHeader) {
                currentFile.newName = values[1];
            }
            currentFile.isRename = true;
        }
        else if ((values = binaryFiles.exec(line))) {
            currentFile.isBinary = true;
            currentFile.oldName = getFilename(values[1], undefined, config.srcPrefix);
            currentFile.newName = getFilename(values[2], undefined, config.dstPrefix);
            startBlock('Binary file');
        }
        else if (binaryDiff.test(line)) {
            currentFile.isBinary = true;
            startBlock(line);
        }
        else if ((values = similarityIndex.exec(line))) {
            currentFile.unchangedPercentage = parseInt(values[1], 10);
        }
        else if ((values = dissimilarityIndex.exec(line))) {
            currentFile.changedPercentage = parseInt(values[1], 10);
        }
        else if ((values = index.exec(line))) {
            currentFile.checksumBefore = values[1];
            currentFile.checksumAfter = values[2];
            values[3] && (currentFile.mode = values[3]);
        }
        else if ((values = combinedIndex.exec(line))) {
            currentFile.checksumBefore = [values[2], values[3]];
            currentFile.checksumAfter = values[1];
        }
        else if ((values = combinedMode.exec(line))) {
            currentFile.oldMode = [values[2], values[3]];
            currentFile.newMode = values[1];
        }
        else if ((values = combinedNewFile.exec(line))) {
            currentFile.newFileMode = values[1];
            currentFile.isNew = true;
        }
        else if ((values = combinedDeletedFile.exec(line))) {
            currentFile.deletedFileMode = values[1];
            currentFile.isDeleted = true;
        }
    });
    saveBlock();
    saveFile();
    return files;
}
//# sourceMappingURL=diff-parser.js.map