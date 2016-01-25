if (Meteor.isClient) {
  // This code only runs on the client
  Template.body.helpers({
    topics: [
      { text: "This is topic 1" },
      { text: "This is topic 2" },
      { text: "This is topic 3" }
    ]
  });
}

Topics = new Mongo.Collection("topics");
Association_Lists = new Mongo.Collection("association_lists")
Setup_Premises = new Mongo.Collection("setup_premises")
Punch_Premises = new Mongo.Collection("punch_premises")
Assumptions = new Mongo.Collection("assumptions")
Connections = new Mongo.Collection("connections")
Reinterpretations = new Mongo.Collection("reinterpretations")
Jokes = new Mongo.Collection("jokes")





if (Meteor.isServer) {
  // This code only runs on the server
  // Only publish topics that are public or belong to the current user
  Meteor.publish("topics", function () {
    return Topics.find({
      $or: [
        { private: {$ne: true} },
        { owner: this.userId }
      ]
    });
  });
}
 
if (Meteor.isClient) {
  // This code only runs on the client
  Meteor.subscribe("topics");  

  Template.body.helpers({
    step: function() {
      return Template.instance().currentStep.get();
    },
    stepData: function() {
      var step = Template.instance().currentStep.get();

      var data = {
        "books": [
          { "name": "Seeking Wisdom: From Darwin to Munger", "creator": "Peter Bevelin" }
          [...]
        ],
        "movies": [
          { "name": "Ghostbusters", "creator": "Dan Aykroyd" },
          [...]
        ],
        "games": [
          { "name": "Grand Theft Auto V", "creator": "Rockstar Games" },
          [...]
        ]
      };

      return data[ step ];
    }


    topics: function () {
      // Show newest topics at the top
      if (Session.get("hideCompleted")) {
        // If hide completed is checked, filter topics
        return Topics.find({checked: {$ne: true}}, {sort: {createdAt: -1}});
      } else {
        // Otherwise, return all of the topics
        return Topics.find({}, {sort: {createdAt: -1}});
      }
    },
    hideCompleted: function () {
      return Session.get("hideCompleted");
      },
    incompleteCount: function () {
      return Topics.find({checked: {$ne: true}}).count();
    }
  });

  Template.body.events({
    "submit .new-topic": function (event) {
      // Prevent default browser form submit
      event.preventDefault();
 
      // Get value from form element
      var text = event.target.text.value;
 
      // Insert a topic into the collection
      Meteor.call("addTopic", text);
 
      // Clear form
      event.target.text.value = "";
    },
    "change .hide-completed input": function (event) {
      Session.set("hideCompleted", event.target.checked);
    }
  });

  Template.topic.helpers({
    isOwner: function () {
      return this.owner === Meteor.userId();
    }
  });

  Template.topic.events({
    "click .toggle-checked": function () {
      // Set the checked property to the opposite of its current value
      Meteor.call("setChecked", this._id, ! this.checked);
    },
    "click .delete": function () {
      Meteor.call("deleteTopic", this._id);
    },
    "click .toggle-private": function () {
      Meteor.call("setPrivate", this._id, ! this.private);
    },
    "click .text": function () {
      Meteor.call("openAssociationList", this._id);
    }
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_ONLY"
  });
}

Meteor.methods({
  addTopic: function (text) {
    // Make sure the user is logged in before inserting a topic
    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized");
    }
 
    Topics.insert({
      text: text,
      createdAt: new Date(),
      owner: Meteor.userId(),
      username: Meteor.user().username
    });
  },
  openAssociationList: function (topicId) {
    var topic = Topics.findOne(topicId);
    if (topic.private && topic.owner !== Meteor.userId()) {
      // If the topic is private, make sure only the owner can see the list
      throw new Meteor.Error("not-authorized");
    }
    //Open the association list to add 
  },
  deleteTopic: function (topicId) {
    var topic = Topics.findOne(topicId);
    if (topic.private && topic.owner !== Meteor.userId()) {
      // If the topic is private, make sure only the owner can delete it
      throw new Meteor.Error("not-authorized");
    }

    Topics.remove(topicId);
  },
  setChecked: function (topicId, setChecked) {
    var topic = Topics.findOne(topicId);
    if (topic.private && topic.owner !== Meteor.userId()) {
      // If the topic is private, make sure only the owner can check it off
      throw new Meteor.Error("not-authorized");
    }
    
    Topics.update(topicId, { $set: { checked: setChecked} });
  },
  setPrivate: function (topicId, setToPrivate) {
    var topic = Topics.findOne(topicId);
 
    // Make sure only the topic owner can make a topic private
    if (topic.owner !== Meteor.userId()) {
      throw new Meteor.Error("not-authorized");
    }
 
    Topics.update(topicId, { $set: { private: setToPrivate } });
  }
});



