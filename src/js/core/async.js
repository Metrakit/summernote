/**
 * @method readFileAsDataURL
 *
 * read contents of file as representing URL
 *
 * @param {File} file
 * @return {Promise} - then: dataUrl
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * @method createImage
 *
 * create `<image>` from url string
 *
 * @param {String} url
 * @return {Promise} - then: $image
 */
export function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.style.display = 'none';

    img.onload = () => {
      document.body.removeChild(img);
      resolve(img);
    };

    img.onerror = img.onabort = () => {
      document.body.removeChild(img);
      reject(img);
    };

    document.body.appendChild(img);
    img.src = url;
  });
}
