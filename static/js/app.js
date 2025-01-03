const DEFAULT_LANG = 'en';
const SUPPORTED_LANG = {
    'en': {
        err: 'Error',
        pepw: 'Please enter password.',
        pwcnbe: 'Password is empty!',
        enpw: 'Enter a new password(Keeping it empty will remove the current password)',
        pwss: 'Password set successfully.',
        pwrs: 'Password removed successfully.',
        cpys: 'Copied!',
    },
    'zh': {
        err: '出错了',
        pepw: '请输入密码',
        pwcnbe: '密码不能为空！',
        enpw: '输入新密码（留空可清除当前密码）',
        pwss: '密码设置成功！',
        pwrs: '密码清除成功！',
        cpys: '已复制',
    }
};

const getI18n = key => {
    const userLang = (navigator.language || navigator.userLanguage || DEFAULT_LANG).split('-')[0];
    const targetLang = Object.keys(SUPPORTED_LANG).find(l => l === userLang) || DEFAULT_LANG;
    return SUPPORTED_LANG[targetLang][key];
};

const showMessage = (message, type = 'info') => {
    const $messageBox = document.querySelector('#message-box');
    if ($messageBox) {
        $messageBox.textContent = message;
        $messageBox.className = `message-box ${type}`; // Add class for styling if needed
        $messageBox.style.display = 'block';
        setTimeout(() => {
            $messageBox.style.display = 'none';
        }, 3000); // Display message for 3 seconds
    } else {
        alert(message); // Fallback to alert if message box is not present
    }
};

const errHandle = (err) => {
    showMessage(`${getI18n('err')}: ${err}`, 'error');
};

const handlePasswdAuth = async () => {
    const passwd = window.prompt(getI18n('pepw'));
    if (passwd == null) return;

    if (!passwd.trim()) {
        showMessage(getI18n('pwcnbe'), 'warning');
        return;
    }
    const path = location.pathname;
    try {
        const res = await window.fetch(`${path}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                passwd,
            }),
        });
        const data = await res.json();
        if (data.err !== 0) {
            return errHandle(data.msg);
        }
        if (data.data.refresh) {
            window.location.reload();
        }
    } catch (err) {
        errHandle(err);
    }
};

const renderPlain = (node, text) => {
    if (node) {
        node.innerHTML = DOMPurify.sanitize(text);
    }
};

const renderMarkdown = (node, text) => {
    if (node) {
        const parseText = marked.parse(text);
        node.innerHTML = DOMPurify.sanitize(parseText);
    }
};

const handleTextareaInput = ($textarea, $previewMd) => {
    renderMarkdown($previewMd, $textarea.value);
};

const handleTextareaBlur = async ($textarea, $loading) => {
    $loading.style.display = 'inline-block';
    const data = {
        t: $textarea.value,
    };
    try {
        const res = await window.fetch('', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(data),
        });
        const result = await res.json();
        if (result.err !== 0) {
            errHandle(result.msg);
        }
    } catch (err) {
        errHandle(err);
    } finally {
        $loading.style.display = 'none';
    }
};

const handlePasswordButtonClick = async ($pwBtn) => {
    const passwd = window.prompt(getI18n('enpw'));
    if (passwd == null) return;

    const path = window.location.pathname;
    try {
        const res = await window.fetch(`${path}/pw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                passwd: passwd.trim(),
            }),
        });
        const data = await res.json();
        if (data.err !== 0) {
            return errHandle(data.msg);
        }
        showMessage(passwd ? getI18n('pwss') : getI18n('pwrs'), 'success');
    } catch (err) {
        errHandle(err);
    }
};

const handleModeButtonClick = async ($modeBtn, $previewPlain, $previewMd, $textarea) => {
    const isMd = $modeBtn.checked;
    const path = window.location.pathname;
    try {
        const res = await window.fetch(`${path}/setting`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mode: isMd ? 'md' : 'plain',
            }),
        });
        const data = await res.json();
        if (data.err !== 0) {
            return errHandle(data.msg);
        }
        window.location.reload();
    } catch (err) {
        errHandle(err);
    }
};

const handleShareButtonClick = async ($shareBtn, $shareInput, $shareModal) => {
    const isShare = $shareBtn.checked;
    const path = window.location.pathname;
    try {
        const res = await window.fetch(`${path}/setting`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                share: isShare,
            }),
        });
        const data = await res.json();
        if (data.err !== 0) {
            return errHandle(data.msg);
        }
        if (isShare) {
            const origin = window.location.origin;
            const url = `${origin}/share/${data.data}`;
            $shareInput.value = url;
            $shareModal.style.display = 'block';
        }
    } catch (err) {
        errHandle(err);
    }
};

const handleShareModal = ($shareModal, $closeBtn, $copyBtn, $shareInput) => {
    $closeBtn.onclick = () => {
        $shareModal.style.display = 'none';
    };
    $copyBtn.onclick = () => {
        clipboardCopy($shareInput.value);
        const originText = $copyBtn.innerHTML;
        const originColor = $copyBtn.style.background;
        $copyBtn.innerHTML = getI18n('cpys');
        $copyBtn.style.background = 'orange';
        window.setTimeout(() => {
            $shareModal.style.display = 'none';
            $copyBtn.innerHTML = originText;
            $copyBtn.style.background = originColor;
        }, 1500);
    };
};

window.addEventListener('DOMContentLoaded', () => {
    const $textarea = document.querySelector('#contents');
    const $loading = document.querySelector('#loading');
    const $pwBtn = document.querySelector('.opt-pw');
    const $modeBtn = document.querySelector('.opt-mode > input');
    const $shareBtn = document.querySelector('.opt-share > input');
    const $previewPlain = document.querySelector('#preview-plain');
    const $previewMd = document.querySelector('#preview-md');
    const $shareModal = document.querySelector('.share-modal');
    const $closeBtn = document.querySelector('.share-modal .close-btn');
    const $copyBtn = document.querySelector('.share-modal .opt-button');
    const $shareInput = document.querySelector('.share-modal input');

    renderPlain($previewPlain, $textarea.value);
    renderMarkdown($previewMd, $textarea.value);

    // Cache frequently used elements
    const cachedElements = {
        $textarea,
        $loading,
        $pwBtn,
        $modeBtn,
        $shareBtn,
        $previewPlain,
        $previewMd,
        $shareModal,
        $closeBtn,
        $copyBtn,
        $shareInput
    };

    if ($textarea) {
        $textarea.oninput = () => handleTextareaInput($textarea, $previewMd); // 输入时更新预览
        $textarea.addEventListener('blur', () => handleTextareaBlur($textarea, $loading)); // 失去焦点时保存
    }

    if ($pwBtn) {
        $pwBtn.onclick = () => handlePasswordButtonClick($pwBtn);
    }

    if ($modeBtn) {
        $modeBtn.onclick = () => handleModeButtonClick($modeBtn, $previewPlain, $previewMd, $textarea);
    }

    if ($shareBtn) {
        $shareBtn.onclick = () => handleShareButtonClick($shareBtn, $shareInput, $shareModal);
    }

    if ($shareModal) {
        handleShareModal($shareModal, $closeBtn, $copyBtn, $shareInput);
    }
});
