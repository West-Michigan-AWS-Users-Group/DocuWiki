import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam';
import elbv2 = require('aws-cdk-lib/aws-elasticloadbalancingv2');
import {CfnOutput, Duration} from "aws-cdk-lib";

export class DocuWikiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC');

    const cluster = new ecs.Cluster(this, 'Cluster', {
    });

    const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    fargateTaskDefinition.addContainer("DocuWikiContainer", {
      image: ecs.ContainerImage.fromRegistry("lscr.io/linuxserver/dokuwiki:latest"),
      portMappings: [{ containerPort: 80 }],
    });

    fargateTaskDefinition.addToTaskRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ssmmessages:CreateControlChannel',
            'ssmmessages:CreateDataChannel',
            'ssmmessages:OpenControlChannel',
            'ssmmessages:OpenDataChannel'],
          resources: ['*']
        }),
    )

    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allow traffic to ECS Fargate service and NFS EFS volume',
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(
        securityGroup,
        ec2.Port.allTraffic(),
        'Self referencing rule',
    );

    securityGroup.addIngressRule(
        ec2.Peer.ipv4('98.243.157.138/32'),
        ec2.Port.tcp(80),
        'Allow HTTP traffic',
    )

    // Add an Elastic File System volume to the task definition
    const DocuWikiEfs = new efs.FileSystem(this, 'DocuWikiEfs', {
      vpc,
      allowAnonymousAccess: true,
      securityGroup,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
    });

    const volume = {
      name: "volume",
      efsVolumeConfiguration: {
        fileSystemId: DocuWikiEfs.fileSystemId,
        transitEncryption: 'ENABLED',
      },
    };

    fargateTaskDefinition.addVolume(volume);

    const docuWikiService = new ecs.FargateService(this,
        'docuWikiService', {
      cluster,
      taskDefinition: fargateTaskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      securityGroups: [securityGroup],
      enableExecuteCommand: true,
    });

    docuWikiService.taskDefinition.defaultContainer?.addMountPoints({
      containerPath: "/config",
      sourceVolume: volume.name,
      readOnly: false,
    });

    docuWikiService.node.addDependency(DocuWikiEfs);

    // Create ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'alb', {
      vpc,
      internetFacing: true,
      securityGroup: securityGroup,
    });

    const listener = alb.addListener('listener', {
      port: 80,
      open: true,
      // Default Target Group
      defaultAction: elbv2.ListenerAction.fixedResponse(200)
    });

    // Attach ALB to ECS Service
    listener.addTargets('ECS', {
      port: 80,
      healthCheck: {
        path: "/",
        interval: Duration.seconds(30),
        timeout: Duration.seconds(3),
      },
      targets: [docuWikiService]
    });

    new CfnOutput(this, 'LoadBalancerDNS', { value: alb.loadBalancerDnsName, });

  }
}
