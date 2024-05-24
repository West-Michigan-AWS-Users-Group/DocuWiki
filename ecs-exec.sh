#!/bin/bash

# Check if the cluster name is provided as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 <cluster-name>"
  exit 1
fi

# Define the cluster name from the argument
CLUSTER_NAME="$1"

# Fetch the task ID of the running task
TASK_ID=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --desired-status RUNNING --query "taskArns[0]" --output text)

# Check if TASK_ID is empty
if [ -z "$TASK_ID" ]; then
  echo "No running task found in cluster $CLUSTER_NAME."
  exit 1
fi

# Fetch the container name from the task
CONTAINER_NAME=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ID" --query "tasks[0].containers[0].name" --output text)

# Check if CONTAINER_NAME is empty
if [ -z "$CONTAINER_NAME" ]; then
  echo "No container found in task $TASK_ID."
  exit 1
fi

# Print the task ID and container name
echo "Task ID: $TASK_ID"
echo "Container Name: $CONTAINER_NAME"
ech "Cluster Name: $CLUSTER_NAME"

# Print the command to be executed
echo "Executing command: /bin/bash"
# Echo back the ecs execute command
echo "aws ecs execute-command --cluster $CLUSTER_NAME --task $TASK_ID --container $CONTAINER_NAME --command /bin/bash --interactive"

# Execute the command using the AWS CLI
aws ecs execute-command --cluster "$CLUSTER_NAME" --task "$TASK_ID" --container "$CONTAINER_NAME" --command "/bin/bash" --interactive
