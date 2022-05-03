#!/bin/sh

if [ "$INPUT_DEBUG_MODE" = true ]; then
  echo '---------------------------'
  printenv
  echo '---------------------------'
fi

upload_sources() {
  if [ -n "$INPUT_UPLOAD_SOURCES_ARGS" ]; then
    UPLOAD_SOURCES_OPTIONS="${UPLOAD_SOURCES_OPTIONS} ${INPUT_UPLOAD_SOURCES_ARGS}"
  fi

  echo "UPLOAD SOURCES"
  crowdin upload sources "$@" $UPLOAD_SOURCES_OPTIONS
}

upload_translations() {
  if [ -n "$INPUT_UPLOAD_LANGUAGE" ]; then
    UPLOAD_TRANSLATIONS_OPTIONS="${UPLOAD_TRANSLATIONS_OPTIONS} --language=${INPUT_UPLOAD_LANGUAGE}"
  fi

  if [ "$INPUT_AUTO_APPROVE_IMPORTED" = true ]; then
    UPLOAD_TRANSLATIONS_OPTIONS="${UPLOAD_TRANSLATIONS_OPTIONS} --auto-approve-imported"
  fi

  if [ "$INPUT_IMPORT_EQ_SUGGESTIONS" = true ]; then
    UPLOAD_TRANSLATIONS_OPTIONS="${UPLOAD_TRANSLATIONS_OPTIONS} --import-eq-suggestions"
  fi

  if [ -n "$INPUT_UPLOAD_TRANSLATIONS_ARGS" ]; then
    UPLOAD_TRANSLATIONS_OPTIONS="${UPLOAD_TRANSLATIONS_OPTIONS} ${INPUT_UPLOAD_TRANSLATIONS_ARGS}"
  fi

  echo "UPLOAD TRANSLATIONS"
  crowdin upload translations "$@" $UPLOAD_TRANSLATIONS_OPTIONS
}

download_translations() {
  if [ -n "$INPUT_DOWNLOAD_LANGUAGE" ]; then
    DOWNLOAD_TRANSLATIONS_OPTIONS="${DOWNLOAD_TRANSLATIONS_OPTIONS} --language=${INPUT_DOWNLOAD_LANGUAGE}"
  elif [ -n "$INPUT_LANGUAGE" ]; then #back compatibility for older versions
    DOWNLOAD_TRANSLATIONS_OPTIONS="${DOWNLOAD_TRANSLATIONS_OPTIONS} --language=${INPUT_LANGUAGE}"
  fi

  if [ "$INPUT_SKIP_UNTRANSLATED_STRINGS" = true ]; then
    DOWNLOAD_TRANSLATIONS_OPTIONS="${DOWNLOAD_TRANSLATIONS_OPTIONS} --skip-untranslated-strings"
  fi

  if [ "$INPUT_SKIP_UNTRANSLATED_FILES" = true ]; then
    DOWNLOAD_TRANSLATIONS_OPTIONS="${DOWNLOAD_TRANSLATIONS_OPTIONS} --skip-untranslated-files"
  fi

  if [ "$INPUT_EXPORT_ONLY_APPROVED" = true ]; then
    DOWNLOAD_TRANSLATIONS_OPTIONS="${DOWNLOAD_TRANSLATIONS_OPTIONS} --export-only-approved"
  fi

  if [ -n "$INPUT_DOWNLOAD_TRANSLATIONS_ARGS" ]; then
    DOWNLOAD_TRANSLATIONS_OPTIONS="${DOWNLOAD_TRANSLATIONS_OPTIONS} ${INPUT_DOWNLOAD_TRANSLATIONS_ARGS}"
  fi

  echo "DOWNLOAD TRANSLATIONS"
  crowdin download "$@" $DOWNLOAD_TRANSLATIONS_OPTIONS
}

create_pull_request() {
  LOCALIZATION_BRANCH="${1}"

  AUTH_HEADER="Authorization: token ${GITHUB_TOKEN}"
  HEADER="Accept: application/vnd.github.v3+json; application/vnd.github.antiope-preview+json; application/vnd.github.shadow-cat-preview+json"

  if [ -n "$INPUT_GITHUB_API_BASE_URL" ]; then
    REPO_URL="https://${INPUT_GITHUB_API_BASE_URL}/repos/${GITHUB_REPOSITORY}"
  else
    REPO_URL="https://api.${INPUT_GITHUB_BASE_URL}/repos/${GITHUB_REPOSITORY}"
  fi

  PULLS_URL="${REPO_URL}/pulls"

  echo "CHECK IF ISSET SAME PULL REQUEST"

  if [ -n "$INPUT_PULL_REQUEST_BASE_BRANCH_NAME" ]; then
    BASE_BRANCH="$INPUT_PULL_REQUEST_BASE_BRANCH_NAME"
  else
    if [ -n "$GITHUB_HEAD_REF" ]; then
      BASE_BRANCH=${GITHUB_HEAD_REF}
    else
      BASE_BRANCH=${GITHUB_REF#refs/heads/}
    fi
  fi

  PULL_REQUESTS_QUERY_PARAMS="?base=${BASE_BRANCH}&head=${LOCALIZATION_BRANCH}"

  PULL_REQUESTS=$(echo "$(curl -sSL -H "${AUTH_HEADER}" -H "${HEADER}" -X GET "${PULLS_URL}${PULL_REQUESTS_QUERY_PARAMS}")" | jq --raw-output '.[] | .head.ref ')

  if echo "$PULL_REQUESTS " | grep -q "$LOCALIZATION_BRANCH "; then
    echo "PULL REQUEST ALREADY EXIST"
  else
    echo "CREATE PULL REQUEST"

    if [ -n "$INPUT_PULL_REQUEST_BODY" ]; then
      BODY=",\"body\":\"${INPUT_PULL_REQUEST_BODY//$'\n'/\\n}\""
    fi

    PULL_RESPONSE_DATA="{\"title\":\"${INPUT_PULL_REQUEST_TITLE}\", \"base\":\"${BASE_BRANCH}\", \"head\":\"${LOCALIZATION_BRANCH}\" ${BODY}}"

    PULL_RESPONSE=$(curl -sSL -H "${AUTH_HEADER}" -H "${HEADER}" -X POST --data "${PULL_RESPONSE_DATA}" "${PULLS_URL}")

    set +x
    PULL_REQUESTS_URL=$(echo "${PULL_RESPONSE}" | jq '.html_url')
    PULL_REQUESTS_NUMBER=$(echo "${PULL_RESPONSE}" | jq '.number')
    view_debug_output

    if [ -n "$INPUT_PULL_REQUEST_LABELS" ]; then
      PULL_REQUEST_LABELS=$(echo "[\"${INPUT_PULL_REQUEST_LABELS}\"]" | sed 's/, \|,/","/g')

      if [ "$(echo "$PULL_REQUEST_LABELS" | jq -e . > /dev/null 2>&1; echo $?)" -eq 0 ]; then
        echo "ADD LABELS TO PULL REQUEST"

        ISSUE_URL="${REPO_URL}/issues/${PULL_REQUESTS_NUMBER}"

        LABELS_DATA="{\"labels\":${PULL_REQUEST_LABELS}}"
        curl -sSL -H "${AUTH_HEADER}" -H "${HEADER}" -X PATCH --data "${LABELS_DATA}" "${ISSUE_URL}"
      else
        echo "JSON OF pull_request_labels IS INVALID: ${PULL_REQUEST_LABELS}"
      fi
    fi

    echo "PULL REQUEST CREATED: ${PULL_REQUESTS_URL}"
  fi
}

push_to_branch() {
  LOCALIZATION_BRANCH=${INPUT_LOCALIZATION_BRANCH_NAME}

  REPO_URL="https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@${INPUT_GITHUB_BASE_URL}/${GITHUB_REPOSITORY}.git"

  echo "CONFIGURATION GIT USER"
  git config --global user.email "${INPUT_GITHUB_USER_EMAIL}"
  git config --global user.name "${INPUT_GITHUB_USER_NAME}"

  if [ ${GITHUB_REF#refs/heads/} != $GITHUB_REF ]; then
    git checkout "${GITHUB_REF#refs/heads/}"
  fi

  if [ -n "$(git show-ref refs/heads/${LOCALIZATION_BRANCH})" ]; then
    git checkout "${LOCALIZATION_BRANCH}"
  else
    git checkout -b "${LOCALIZATION_BRANCH}"
  fi  
  
  git add .

  if [ ! -n "$(git status -s)" ]; then
    echo "NOTHING TO COMMIT"
    return
  fi

  echo "PUSH TO BRANCH ${LOCALIZATION_BRANCH}"
  git commit --no-verify -m "${INPUT_COMMIT_MESSAGE}"
  git push --no-verify --force "${REPO_URL}"

  if [ "$INPUT_CREATE_PULL_REQUEST" = true ]; then
    create_pull_request "${LOCALIZATION_BRANCH}"
  fi
}

view_debug_output() {
  if [ "$INPUT_DEBUG_MODE" = true ]; then
    set -x
  fi
}

setup_commit_signing() {
  echo "FOUND PRIVATE KEY, WILL SETUP GPG KEYSTORE"

  echo "${INPUT_GPG_PRIVATE_KEY}" > private.key

  gpg --import private.key

  GPG_KEY_ID=$(gpg --list-secret-keys --keyid-format=long | grep -o "rsa\d\+\/\(\w\+\)" | head -n1 | sed "s/rsa\d\+\/\(\w\+\)/\1/")
  GPG_KEY_OWNER_NAME=$(gpg --list-secret-keys --keyid-format=long | grep  "uid" | sed "s/.\+] \(.\+\) <\(.\+\)>/\1/")
  GPG_KEY_OWNER_EMAIL=$(gpg --list-secret-keys --keyid-format=long | grep  "uid" | sed "s/.\+] \(.\+\) <\(.\+\)>/\2/")
  echo "Imported key information:"
  echo "      Key id: ${GPG_KEY_ID}"
  echo "  Owner name: ${GPG_KEY_OWNER_NAME}"
  echo " Owner email: ${GPG_KEY_OWNER_EMAIL}"

  git config --global user.signingkey "$GPG_KEY_ID"
  git config --global commit.gpgsign true

  rm private.key
}

get_branch_available_options() {
  for OPTION in "$@" ; do
    if echo "$OPTION" | egrep -vq "^(--dryrun|--branch|--source|--translation)"; then
      AVAILABLE_OPTIONS="${AVAILABLE_OPTIONS} ${OPTION}"
    fi
  done

  echo "$AVAILABLE_OPTIONS"
}

echo "STARTING CROWDIN ACTION"

cd "${GITHUB_WORKSPACE}" || exit 1

git config --global --add safe.directory $GITHUB_WORKSPACE

view_debug_output

set -e

#SET OPTIONS
set -- --no-progress --no-colors

if [ "$INPUT_DEBUG_MODE" = true ]; then
  set -- "$@" --verbose --debug
fi

if [ -n "$INPUT_CROWDIN_BRANCH_NAME" ]; then
  set -- "$@" --branch="${INPUT_CROWDIN_BRANCH_NAME}"
fi

if [ -n "$INPUT_IDENTITY" ]; then
  set -- "$@" --identity="${INPUT_IDENTITY}"
fi

if [ -n "$INPUT_CONFIG" ]; then
  set -- "$@" --config="${INPUT_CONFIG}"
fi

if [ "$INPUT_DRYRUN_ACTION" = true ]; then
  set -- "$@" --dryrun
fi

#SET CONFIG OPTIONS
if [ -n "$INPUT_PROJECT_ID" ]; then
  set -- "$@" --project-id=${INPUT_PROJECT_ID}
fi

if [ -n "$INPUT_TOKEN" ]; then
  set -- "$@" --token="${INPUT_TOKEN}"
fi

if [ -n "$INPUT_BASE_URL" ]; then
  set -- "$@" --base-url="${INPUT_BASE_URL}"
fi

if [ -n "$INPUT_BASE_PATH" ]; then
  set -- "$@" --base-path="${INPUT_BASE_PATH}"
fi

if [ -n "$INPUT_SOURCE" ]; then
  set -- "$@" --source="${INPUT_SOURCE}"
fi

if [ -n "$INPUT_TRANSLATION" ]; then
  set -- "$@" --translation="${INPUT_TRANSLATION}"
fi

#EXECUTE COMMANDS

if [ -n "$INPUT_ADD_CROWDIN_BRANCH" ]; then
  NEW_BRANCH_OPTIONS=$( get_branch_available_options "$@" )

  if [ -n "$INPUT_NEW_BRANCH_PRIORITY" ]; then
    NEW_BRANCH_OPTIONS="${NEW_BRANCH_OPTIONS} --priority=${INPUT_NEW_BRANCH_PRIORITY}"
  fi

  echo "CREATING BRANCH $INPUT_ADD_CROWDIN_BRANCH"

  crowdin branch add $INPUT_ADD_CROWDIN_BRANCH $NEW_BRANCH_OPTIONS --title="${INPUT_NEW_BRANCH_TITLE}" --export-pattern="${INPUT_NEW_BRANCH_EXPORT_PATTERN}"
fi

if [ "$INPUT_UPLOAD_SOURCES" = true ]; then
  upload_sources "$@"
fi

if [ "$INPUT_UPLOAD_TRANSLATIONS" = true ]; then
  upload_translations "$@"
fi

if [ "$INPUT_DOWNLOAD_TRANSLATIONS" = true ]; then
  download_translations "$@"

  if [ "$INPUT_PUSH_TRANSLATIONS" = true ]; then
    [ -z "${GITHUB_TOKEN}" ] && {
      echo "CAN NOT FIND 'GITHUB_TOKEN' IN ENVIRONMENT VARIABLES"
      exit 1
    }

    if [ -n "${INPUT_GPG_PRIVATE_KEY}" ]; then
      setup_commit_signing
    fi

    push_to_branch
  fi
fi

if [ -n "$INPUT_DELETE_CROWDIN_BRANCH" ]; then
  echo "REMOVING BRANCH $INPUT_DELETE_CROWDIN_BRANCH"

  crowdin branch delete $INPUT_DELETE_CROWDIN_BRANCH $( get_branch_available_options "$@" )
fi
