FROM crowdin/cli:3.13.0

RUN apk --no-cache add curl git git-lfs jq gnupg;

COPY . .
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
