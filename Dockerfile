FROM crowdin/cli:4.9.1

RUN apk --no-cache add curl git git-lfs jq gnupg;

COPY . .
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
