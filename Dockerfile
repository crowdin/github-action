FROM crowdin/cli:5.0.0-next.3

RUN apk --no-cache add curl git git-lfs jq gnupg su-exec;

COPY . .
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
