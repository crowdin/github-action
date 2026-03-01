FROM crowdin/cli:4.14.0

RUN apk --no-cache add curl git git-lfs jq gnupg;
RUN addgroup -g 1000 runner \
    && adduser -D -u 1000 -G runner runner

COPY . .
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
    && chown -R runner:runner /app /entrypoint.sh
USER ubuntu

ENTRYPOINT ["/entrypoint.sh"]
