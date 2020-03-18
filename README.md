# ankiMQTTController



### Configuring the Bluetooth adapter for non root (sudo access)
By default access to a Bluetooht adapter is restricted to root/sudo access. This prevents a nodejs based application from accessing the adapter. The error messages are usually quite vague or you get none at all unless you enable DEBUG for nodejs:

```
DEBUG=hci node controller.js config-guardian.properties
```
You will likely see error messages in the debug log like:
```
  hci set scan enabled - writing: 010c20020001 +0ms
  hci onSocketError: EPERM, Operation not permitted +0ms
  hci set scan parameters - writing: 010b200701100010000000 +1ms
  hci onSocketError: EPERM, Operation not permitted +0ms
  hci onSocketData: 040e0a010910001571da7d1a00 +0ms
```
If this is the case then you will want to change the capabilities of the node application using this command:
```
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```

