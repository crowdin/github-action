#!/bin/sh

init_options() {
  OPTIONS="--no-progress";

  if [[ "$INPUT_DEBUG_MODE" = true ]]; then
    set -x;

    OPTIONS="${OPTIONS} --verbose"
  fi

  if [[ -n "$INPUT_CROWDIN_BRANCH_NAME" ]]; then
    OPTIONS="${OPTIONS} --branch=${INPUT_CROWDIN_BRANCH_NAME}"
  fi

  if [[ -n "$INPUT_IDENTITY" ]]; then
    OPTIONS="${OPTIONS} --identity=${INPUT_IDENTITY}"
  fi

  if [[ -n "$INPUT_CONFIG" ]]; then
    OPTIONS="${OPTIONS} --config=${INPUT_CONFIG}"
  fi

  if [[ "$INPUT_DRYRUN_ACTION" = true ]]; then
    OPTIONS="${OPTIONS} --dryrun"
  fi

  echo ${OPTIONS};
}

init_config_options() {
  CONFIG_OPTIONS="";

  if [[ -n "$INPUT_PROJECT_ID" ]]; then
    CONFIG_OPTIONS="${CONFIG_OPTIONS} --project-id=${INPUT_PROJECT_ID}"
  fi

  if [[ -n "$INPUT_TOKEN" ]]; then
    CONFIG_OPTIONS="${CONFIG_OPTIONS} --token=${INPUT_TOKEN}"
  fi

  if [[ -n "$INPUT_BASE_URL" ]]; then
    CONFIG_OPTIONS="${CONFIG_OPTIONS} --base-url=${INPUT_BASE_URL}"
  fi

  if [[ -n "$INPUT_BASE_PATH" ]]; then
    CONFIG_OPTIONS="${CONFIG_OPTIONS} --base-path=${INPUT_BASE_PATH}"
  fi

  if [[ -n "$INPUT_SOURCE" ]]; then
    CONFIG_OPTIONS="${CONFIG_OPTIONS} --source=${INPUT_SOURCE}"
  fi

  if [[ -n "$INPUT_TRANSLATION" ]]; then
    CONFIG_OPTIONS="${CONFIG_OPTIONS} --translation=${INPUT_TRANSLATION}"
  fi

  echo ${CONFIG_OPTIONS};
}

upload_sources() {
  echo "UPLOAD SOURCES";
  crowdin upload sources ${CONFIG_OPTIONS} ${OPTIONS};
}

upload_translations() {
  if [[ -n "$INPUT_UPLOAD_LANGUAGE" ]]; then
    OPTIONS="${OPTIONS} --language=${INPUT_UPLOAD_LANGUAGE}"
  fi

  if [[ "$INPUT_AUTO_APPROVE_IMPORTED" = true ]]; then
    OPTIONS="${OPTIONS} --auto-approve-imported"
  fi

  if [[ "$INPUT_IMPORT_EQ_SUGGESTIONS" = true ]]; then
    OPTIONS="${OPTIONS} --import-eq-suggestions"
  fi

  if [[ "$INPUT_IMPORT_DUPLICATES" = true ]]; then
    OPTIONS="${OPTIONS} --import-duplicates"
  fi

  echo "UPLOAD TRANSLATIONS";
  crowdin upload translations ${CONFIG_OPTIONS} ${OPTIONS};
}

download_translations() {
  if [[ -n "$INPUT_DOWNLOAD_LANGUAGE" ]]; then
    OPTIONS="${OPTIONS} --language=${INPUT_DOWNLOAD_LANGUAGE}"
  elif [[ -n "$INPUT_LANGUAGE" ]]; then #back compatibility for older versions
    OPTIONS="${OPTIONS} --language=${INPUT_LANGUAGE}"
  fi

  echo "DOWNLOAD TRANSLATIONS";
  crowdin download ${CONFIG_OPTIONS} ${OPTIONS};
}

create_pull_request() {
  TITLE="${1}";

  LOCALIZATION_BRANCH="${2}";
  BASE_BRANCH=$(jq -r ".repository.default_branch" "$GITHUB_EVENT_PATH");

  AUTH_HEADER="Authorization: token ${GITHUB_TOKEN}";
  HEADER="Accept: application/vnd.github.v3+json; application/vnd.github.antiope-preview+json; application/vnd.github.shadow-cat-preview+json";

  PULLS_URL="https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls";

  echo "CHECK IF ISSET SAME PULL REQUEST";
  DATA="{\"base\":\"${BASE_BRANCH}\", \"head\":\"${LOCALIZATION_BRANCH}\"}";
  RESPONSE=$(curl -sSL -H "${AUTH_HEADER}" -H "${HEADER}" -X GET --data "${DATA}" ${PULLS_URL});
  PULL_REQUESTS=$(echo "${RESPONSE} " | jq --raw-output '.[] | .head.ref');

  if [[ "${PULL_REQUESTS#*$LOCALIZATION_BRANCH }" == "$PULL_REQUESTS" ]]; then
      echo "CREATE PULL REQUEST";

      DATA="{\"title\":\"${TITLE}\", \"base\":\"${BASE_BRANCH}\", \"head\":\"${LOCALIZATION_BRANCH}\"}";
      curl -sSL -H "${AUTH_HEADER}" -H "${HEADER}" -X POST --data "${DATA}" ${PULLS_URL};
    else
      echo "PULL REQUEST ALREADY EXIST";
  fi
}

push_to_branch() {
  LOCALIZATION_BRANCH=${INPUT_LOCALIZATION_BRANCH_NAME};

  COMMIT_MESSAGE="New Crowdin translations by Github Action";

  REPO_URL="https://${GITHUB_ACTOR}:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git";

  echo "CONFIGURATION GIT USER";
  git config --global user.email "support+bot@crowdin.com";
  git config --global user.name "Crowdin Bot";

  git checkout -b ${LOCALIZATION_BRANCH};

  if [[ -n "$(git status -s)" ]]; then
      echo "PUSH TO BRANCH ${LOCALIZATION_BRANCH}";

      git add .;
      git commit -m "${COMMIT_MESSAGE}";
      git push --force "${REPO_URL}";

      if [[ "$INPUT_CREATE_PULL_REQUEST" = true ]]; then
        create_pull_request "${COMMIT_MESSAGE}" "${LOCALIZATION_BRANCH}";
      fi
  else
      echo "NOTHING TO COMMIT";
  fi
}

# STARTING WORK
echo "STARTING CROWDIN ACTION";

set -e;

OPTIONS=$( init_options );
CONFIG_OPTIONS=$( init_config_options );

if [[ "$INPUT_UPLOAD_SOURCES" = true ]]; then
  upload_sources;
fi

if [[ "$INPUT_UPLOAD_TRANSLATIONS" = true ]]; then
  upload_translations;
fi

if [[ "$INPUT_DOWNLOAD_TRANSLATIONS" = true ]]; then
  [[ -z "${GITHUB_TOKEN}" ]] && {
    echo "CAN NOT FIND 'GITHUB_TOKEN' IN ENVIRONMENT VARIABLES";
    exit 1;
  };

  download_translations;

  if [[ "$INPUT_PUSH_TRANSLATIONS" = true ]]; then
    push_to_branch;
  fi
fi
