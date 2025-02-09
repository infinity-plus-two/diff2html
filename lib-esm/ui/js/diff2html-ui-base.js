var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { closeTags, nodeStream, mergeStreams, getLanguage } from './highlight.js-helpers';
import { html, defaultDiff2HtmlConfig } from '../../diff2html';
export var defaultDiff2HtmlUIConfig = __assign(__assign({}, defaultDiff2HtmlConfig), { synchronisedScroll: true, highlight: true, fileListToggle: true, fileListStartVisible: false, highlightLanguages: new Map(), smartSelection: true, fileContentToggle: true, stickyFileHeaders: true });
var Diff2HtmlUI = (function () {
    function Diff2HtmlUI(target, diffInput, config, hljs) {
        if (config === void 0) { config = {}; }
        this.hljs = null;
        this.currentSelectionColumnId = -1;
        this.config = __assign(__assign({}, defaultDiff2HtmlUIConfig), config);
        this.diffHtml = diffInput !== undefined ? html(diffInput, this.config) : target.innerHTML;
        this.targetElement = target;
        if (hljs !== undefined)
            this.hljs = hljs;
    }
    Diff2HtmlUI.prototype.draw = function () {
        this.targetElement.innerHTML = this.diffHtml;
        if (this.config.synchronisedScroll)
            this.synchronisedScroll();
        if (this.config.highlight)
            this.highlightCode();
        if (this.config.fileListToggle)
            this.fileListToggle(this.config.fileListStartVisible);
        if (this.config.fileContentToggle)
            this.fileContentToggle();
        if (this.config.stickyFileHeaders)
            this.stickyFileHeaders();
    };
    Diff2HtmlUI.prototype.synchronisedScroll = function () {
        this.targetElement.querySelectorAll('.d2h-file-wrapper').forEach(function (wrapper) {
            var _a = Array().slice.call(wrapper.querySelectorAll('.d2h-file-side-diff')), left = _a[0], right = _a[1];
            if (left === undefined || right === undefined)
                return;
            var onScroll = function (event) {
                if (event === null || event.target === null)
                    return;
                if (event.target === left) {
                    right.scrollTop = left.scrollTop;
                    right.scrollLeft = left.scrollLeft;
                }
                else {
                    left.scrollTop = right.scrollTop;
                    left.scrollLeft = right.scrollLeft;
                }
            };
            left.addEventListener('scroll', onScroll);
            right.addEventListener('scroll', onScroll);
        });
    };
    Diff2HtmlUI.prototype.fileListToggle = function (startVisible) {
        var showBtn = this.targetElement.querySelector('.d2h-show');
        var hideBtn = this.targetElement.querySelector('.d2h-hide');
        var fileList = this.targetElement.querySelector('.d2h-file-list');
        if (showBtn === null || hideBtn === null || fileList === null)
            return;
        var show = function () {
            showBtn.style.display = 'none';
            hideBtn.style.display = 'inline';
            fileList.style.display = 'block';
        };
        var hide = function () {
            showBtn.style.display = 'inline';
            hideBtn.style.display = 'none';
            fileList.style.display = 'none';
        };
        showBtn.addEventListener('click', function () { return show(); });
        hideBtn.addEventListener('click', function () { return hide(); });
        var hashTag = this.getHashTag();
        if (hashTag === 'files-summary-show')
            show();
        else if (hashTag === 'files-summary-hide')
            hide();
        else if (startVisible)
            show();
        else
            hide();
    };
    Diff2HtmlUI.prototype.fileContentToggle = function () {
        this.targetElement.querySelectorAll('.d2h-file-collapse').forEach(function (fileContentToggleBtn) {
            fileContentToggleBtn.style.display = 'flex';
            var toggleFileContents = function (selector) {
                var _a;
                var fileContents = (_a = fileContentToggleBtn
                    .closest('.d2h-file-wrapper')) === null || _a === void 0 ? void 0 : _a.querySelector(selector);
                if (fileContents !== null && fileContents !== undefined) {
                    fileContentToggleBtn.classList.toggle('d2h-selected');
                    fileContents.classList.toggle('d2h-d-none');
                }
            };
            var toggleHandler = function (e) {
                if (fileContentToggleBtn === e.target)
                    return;
                toggleFileContents('.d2h-file-diff');
                toggleFileContents('.d2h-files-diff');
            };
            fileContentToggleBtn.addEventListener('click', function (e) { return toggleHandler(e); });
        });
    };
    Diff2HtmlUI.prototype.highlightCode = function () {
        var _this = this;
        var hljs = this.hljs;
        if (hljs === null) {
            throw new Error('Missing a `highlight.js` implementation. Please provide one when instantiating Diff2HtmlUI.');
        }
        var files = this.targetElement.querySelectorAll('.d2h-file-wrapper');
        files.forEach(function (file) {
            var language = file.getAttribute('data-lang');
            if (!(_this.config.highlightLanguages instanceof Map)) {
                _this.config.highlightLanguages = new Map(Object.entries(_this.config.highlightLanguages));
            }
            var hljsLanguage = language && _this.config.highlightLanguages.has(language)
                ?
                    _this.config.highlightLanguages.get(language)
                : language
                    ? getLanguage(language)
                    : 'plaintext';
            var codeLines = file.querySelectorAll('.d2h-code-line-ctn');
            codeLines.forEach(function (line) {
                var text = line.textContent;
                var lineParent = line.parentNode;
                if (text === null || lineParent === null || !_this.isElement(lineParent))
                    return;
                var result = closeTags(hljs.highlight(text, {
                    language: hljsLanguage,
                    ignoreIllegals: true,
                }));
                var originalStream = nodeStream(line);
                if (originalStream.length) {
                    var resultNode = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                    resultNode.innerHTML = result.value;
                    result.value = mergeStreams(originalStream, nodeStream(resultNode), text);
                }
                line.classList.add('hljs');
                if (result.language) {
                    line.classList.add(result.language);
                }
                line.innerHTML = result.value;
            });
        });
    };
    Diff2HtmlUI.prototype.stickyFileHeaders = function () {
        this.targetElement.querySelectorAll('.d2h-file-header').forEach(function (header) {
            header.classList.add('d2h-sticky-header');
        });
    };
    Diff2HtmlUI.prototype.smartSelection = function () {
        console.warn('Smart selection is now enabled by default with CSS. No need to call this method anymore.');
    };
    Diff2HtmlUI.prototype.getHashTag = function () {
        var docUrl = document.URL;
        var hashTagIndex = docUrl.indexOf('#');
        var hashTag = null;
        if (hashTagIndex !== -1) {
            hashTag = docUrl.substr(hashTagIndex + 1);
        }
        return hashTag;
    };
    Diff2HtmlUI.prototype.isElement = function (arg) {
        return arg !== null && (arg === null || arg === void 0 ? void 0 : arg.classList) !== undefined;
    };
    return Diff2HtmlUI;
}());
export { Diff2HtmlUI };
//# sourceMappingURL=diff2html-ui-base.js.map