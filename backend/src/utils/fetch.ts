const handleError = (err: Response) => (err.json instanceof Function ? err.json().then(jsonError => Promise.reject(`API JSON Error: ${JSON.stringify(jsonError)}`)) : Promise.reject(`Fetch error: ${err}`));

const handleSuccess = (res: Response) => (res.ok ? res.json() : Promise.reject(res));
const headers = () => ({
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
  },
});

export const get = (url: string) => fetch(url, headers()).then(handleSuccess).catch(handleError);

export const post = (url: string, body: unknown) =>
  fetch(url, {
      ...headers(),
      method: 'POST',
      body: JSON.stringify(body),
  })
  .then(handleSuccess)
  .catch(handleError);

export const put = (url: string, body: unknown) =>
  fetch(url, {
      ...headers(),
      method: 'PUT',
      body: JSON.stringify(body),
  })
  .then(handleSuccess)
  .catch(handleError);

export const remove = (url: string) =>
  fetch(url, {
      ...headers(),
      method: 'DELETE',
  })
  .then(handleSuccess)
  .catch(handleError);