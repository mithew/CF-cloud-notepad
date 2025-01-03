import dayjs from 'dayjs';
import { Router } from 'itty-router';
import Cookies from 'cookie';
import jwt from '@tsndr/cloudflare-worker-jwt';
import { queryNote, MD5, checkAuth, genRandomStr, returnPage, returnJSON, saltPw, getI18n } from './helper';
import { SECRET } from './constant';

// Initialize router
const router = Router();

// Middleware to get language
const getLangMiddleware = (request) => {
    request.lang = getI18n(request);
};

// Middleware to query note
const queryNoteMiddleware = async (request, env) => {
    request.noteData = await queryNote(request.params.path);
};

// Middleware to check authentication
const checkAuthMiddleware = async (request) => {
    const cookie = Cookies.parse(request.headers.get('Cookie') || '');
    request.isAuthenticated = await checkAuth(cookie, request.params.path);
};

// Error handling middleware
const errorHandler = (request, env, error) => {
    console.error('Global error caught:', error);
    return returnJSON(500, 'Internal Server Error');
};

router.get('/', ({ url }) => {
    const newHash = genRandomStr(3);
    return Response.redirect(`${url}${newHash}`, 302);
});

router.get('/share/:md5', getLangMiddleware, async (request) => {
    const { md5 } = request.params;
    const path = await SHARE.get(md5);

    if (!!path) {
        const { value, metadata } = await queryNote(path);
        return returnPage('Share', {
            lang: request.lang,
            title: decodeURIComponent(path),
            content: value,
            ext: metadata,
        });
    }
    return returnPage('Page404', { lang: request.lang, title: '404' });
});

router.get('/:path', getLangMiddleware, queryNoteMiddleware, async (request) => {
    const { path } = request.params;
    const title = decodeURIComponent(path);
    const { value, metadata } = request.noteData;

    if (!metadata.pw) {
        return returnPage('Edit', {
            lang: request.lang,
            title,
            content: value,
            ext: metadata,
        });
    }

    await checkAuthMiddleware(request);
    if (request.isAuthenticated) {
        return returnPage('Edit', {
            lang: request.lang,
            title,
            content: value,
            ext: metadata,
        });
    }
    return returnPage('NeedPasswd', { lang: request.lang, title });
});

router.post('/:path/auth', queryNoteMiddleware, async (request) => {
    const { path } = request.params;
    if (request.headers.get('Content-Type') === 'application/json') {
        const { passwd } = await request.json();
        const { metadata } = request.noteData;

        if (metadata.pw) {
            const storePw = await saltPw(passwd);
            if (metadata.pw === storePw) {
                const token = await jwt.sign({ path }, SECRET);
                return returnJSON(0, { refresh: true }, {
                    'Set-Cookie': Cookies.serialize('auth', token, {
                        path: `/${path}`,
                        expires: dayjs().add(7, 'day').toDate(),
                        httpOnly: true,
                    }),
                });
            }
        }
        return returnJSON(10002, 'Password authentication failed!');
    }
    return returnJSON(400, 'Invalid Content-Type');
});

router.post('/:path/pw', queryNoteMiddleware, async (request) => {
    const { path } = request.params;
    if (request.headers.get('Content-Type') === 'application/json') {
        const cookie = Cookies.parse(request.headers.get('Cookie') || '');
        const { passwd } = await request.json();
        const { value, metadata } = request.noteData;

        await checkAuthMiddleware(request);

        if (!metadata.pw || request.isAuthenticated) {
            const pw = passwd ? await saltPw(passwd) : undefined;
            try {
                await NOTES.put(path, value, {
                    metadata: { ...metadata, pw },
                });
                return returnJSON(0, null, {
                    'Set-Cookie': Cookies.serialize('auth', '', {
                        path: `/${path}`,
                        expires: dayjs().subtract(100, 'day').toDate(),
                        httpOnly: true,
                    }),
                });
            } catch (error) {
                console.error('Error setting password:', error);
                return returnJSON(500, 'Failed to set password');
            }
        }
        return returnJSON(10003, 'Password setting failed or unauthorized!');
    }
    return returnJSON(400, 'Invalid Content-Type');
});

router.post('/:path/setting', queryNoteMiddleware, async (request) => {
    const { path } = request.params;
    if (request.headers.get('Content-Type') === 'application/json') {
        const cookie = Cookies.parse(request.headers.get('Cookie') || '');
        const { mode, share } = await request.json();
        const { value, metadata } = request.noteData;

        await checkAuthMiddleware(request);

        if (!metadata.pw || request.isAuthenticated) {
            try {
                const newMetadata = { ...metadata };
                if (mode !== undefined) newMetadata.mode = mode;
                if (share !== undefined) newMetadata.share = share;

                await NOTES.put(path, value, { metadata: newMetadata });

                if (share !== undefined) {
                    const md5 = await MD5(path);
                    if (share) {
                        await SHARE.put(md5, path);
                        return returnJSON(0, md5);
                    } else {
                        await SHARE.delete(md5);
                        return returnJSON(0);
                    }
                }
                return returnJSON(0);
            } catch (error) {
                console.error('Error updating settings:', error);
                return returnJSON(500, 'Failed to update settings');
            }
        }
        return returnJSON(10004, 'Update settings failed or unauthorized!');
    }
    return returnJSON(400, 'Invalid Content-Type');
});

router.post('/:path', queryNoteMiddleware, async (request) => {
    const { path } = request.params;
    const { metadata } = request.noteData;

    await checkAuthMiddleware(request);

    if (metadata.pw && !request.isAuthenticated) {
        return returnJSON(10002, 'Password authentication failed! Try refreshing this page if you had just set a password.');
    }

    const formData = await request.formData();
    const content = formData.get('t');

    try {
        await NOTES.put(path, content, {
            metadata: { ...metadata, updateAt: dayjs().unix() },
        });
        return returnJSON(0);
    } catch (error) {
        console.error('Error saving note:', error);
        return returnJSON(10001, 'KV insert failed!');
    }
});

router.all('*', getLangMiddleware, ({ request }) => {
    return returnPage('Page404', { lang: request.lang, title: '404' });
});

// Add error handler as the last middleware
addEventListener('fetch', (event) => {
    event.respondWith(router.handle(event.request).catch(error => errorHandler(event.request, globalThis, error)));
});
