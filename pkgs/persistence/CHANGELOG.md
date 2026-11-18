# Changelog

## 0.1.0

- Initial release of event-log persistence through application-supplied append callbacks.
- Batch and serialize writes, preserving failed batches ahead of newer events for retry.
- Provide a browser localStorage adapter; loading stored history remains application-owned.
